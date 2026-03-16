import { useMemo, useState, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, ArrowDown, ExternalLink, FileText, Flag, Bookmark, BookmarkCheck, Pencil, PlayCircle, Plus, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
	addStudyMaterialFavorite,
	createStudyMaterial,
	deleteStudyMaterial,
	fetchStudyMaterials,
	recordStudyMaterialView,
	removeStudyMaterialFavorite,
	reportStudyMaterial,
	uploadStudyMaterialPdf,
	updateStudyMaterial,
	voteStudyMaterial,
	type StudyMaterialFilters,
	type StudyMaterialType,
	type StudyMaterialWithMeta,
} from "@/backend/studyHubApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const universities = [
	"جامعة الدلتا",
	"جامعة حورس",
	"جامعة المنصوره الحكوميه",
	"المنصوره الأهليه",
	"المنصوره الجديده",
	"دمياط الجديده",
];
const universityFacultiesMap: Record<string, string[]> = {
	"جامعة الدلتا": [
		"كلية الطب",
		"كلية طب الفم والأسنان",
		"كلية الصيدلة",
		"كلية العلاج الطبيعي",
		"كلية الهندسة",
		"كلية الذكاء الاصطناعي",
		"كلية إدارة الأعمال",
	],
	"جامعة حورس": [
		"كلية الطب البشري",
		"كلية طب الأسنان",
		"كلية الصيدلة",
		"كلية العلاج الطبيعي",
		"كلية الهندسة",
		"كلية إدارة الأعمال",
		"كلية الألسن والترجمة",
	],
	"جامعة المنصوره الحكوميه": [
		"كلية الطب",
		"كلية طب الأسنان",
		"كلية الصيدلة",
		"كلية التمريض",
		"كلية الهندسة",
		"كلية الحاسبات والمعلومات",
		"كلية العلوم",
		"كلية الزراعة",
		"كلية التجارة",
		"كلية الحقوق",
		"كلية الآداب",
		"كلية التربية",
		"كلية التربية النوعية",
		"كلية التربية الرياضية",
	],
	"المنصوره الأهليه": [
		"كلية الطب",
		"كلية طب الأسنان",
		"كلية الصيدلة",
		"كلية التمريض",
		"كلية الهندسة",
		"كلية علوم الحاسب",
		"كلية إدارة الأعمال",
	],
	"المنصوره الجديده": [
		"كلية الهندسة",
		"كلية علوم الحاسب",
		"كلية إدارة الأعمال",
		"كلية الإعلام",
		"كلية الفنون والتصميم",
	],
	"دمياط الجديده": [
		"كلية الهندسة",
		"كلية الحاسبات والذكاء الاصطناعي",
		"كلية التجارة",
		"كلية الآداب",
		"كلية التربية",
		"كلية الفنون التطبيقية",
	],
};
const years = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "الامتياز"];
const terms = ["الترم الأول", "الترم الثاني", "صيفي"];

const materialTypeOptions: Array<{ value: StudyMaterialType; label: string }> = [
	{ value: "doctor_lecture", label: "محاضرات دكتور" },
	{ value: "ta_section", label: "سكاشن معيد" },
	{ value: "student_summary", label: "ملخصات وملازم طلبة" },
	{ value: "past_exam", label: "امتحانات سابقة" },
];

const materialTypeLabelMap: Record<StudyMaterialType, string> = {
	doctor_lecture: "محاضرات دكتور",
	ta_section: "سكاشن معيد",
	student_summary: "ملخصات وملازم طلبة",
	past_exam: "امتحانات سابقة",
};

type ResourceSourceFilter = "all" | "youtube" | "drive" | "onedrive" | "telegram" | "other";
type SortMode = "smart" | "newest" | "top";

function getResourceSourceLabel(resourceUrl: string): string {
	const url = resourceUrl.toLowerCase();
	if (url.includes("youtube.com") || url.includes("youtu.be")) return "YouTube";
	if (url.includes("drive.google.com")) return "Google Drive";
	if (url.includes("onedrive.live.com") || url.includes("1drv.ms")) return "OneDrive";
	if (url.includes("t.me") || url.includes("telegram.me")) return "Telegram";
	return "رابط خارجي";
}

function getYouTubeVideoId(resourceUrl: string): string | null {
	try {
		const parsed = new URL(resourceUrl);
		const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

		if (host === "youtu.be") {
			const id = parsed.pathname.split("/").filter(Boolean)[0];
			return id || null;
		}

		if (host === "youtube.com" || host === "m.youtube.com") {
			if (parsed.pathname === "/watch") {
				return parsed.searchParams.get("v");
			}

			const parts = parsed.pathname.split("/").filter(Boolean);
			if (parts[0] === "embed" || parts[0] === "shorts") {
				return parts[1] || null;
			}
		}
	} catch {
		return null;
	}

	return null;
}

export default function StudyHub() {
	const { user } = useAuth();
	const queryClient = useQueryClient();

	const [open, setOpen] = useState(false);
	const [filters, setFilters] = useState<StudyMaterialFilters>({
		university: "all",
		faculty: "all",
		studyYear: "all",
		term: "all",
		courseName: "",
		materialType: "all",
	});
		const [viewMode, setViewMode] = useState<"all" | "saved" | "recent">("all");
		const [resourceSourceFilter, setResourceSourceFilter] = useState<ResourceSourceFilter>("all");
		const [sortMode, setSortMode] = useState<SortMode>("smart");

	const [form, setForm] = useState({
		university: universities[0],
		faculty: universityFacultiesMap[universities[0]][0],
		studyYear: years[0],
		term: terms[0],
		courseName: "",
		materialType: "doctor_lecture" as StudyMaterialType,
		title: "",
		description: "",
		resourceUrl: "",
		resourceUrlBackup: "",
	});
	const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);

	const formFacultyOptions = useMemo(() => universityFacultiesMap[form.university] ?? [], [form.university]);

	const filterFacultyOptions = useMemo(() => {
		if (!filters.university || filters.university === "all") {
			return Array.from(new Set(Object.values(universityFacultiesMap).flat()));
		}
		return universityFacultiesMap[filters.university] ?? [];
	}, [filters.university]);

	const queryKey = useMemo(() => ["study-materials", filters, user?.id ?? "anonymous"], [filters, user?.id]);

	const { data: materials = [], isLoading } = useQuery({
		queryKey,
		queryFn: () => fetchStudyMaterials(filters, user?.id),
	});

	const createMaterialMutation = useMutation({
		mutationFn: async () => {
			if (!user?.id) throw new Error("يجب تسجيل الدخول لإضافة محتوى");
			if (!form.courseName.trim() || !form.title.trim()) {
				throw new Error("المادة والعنوان حقول مطلوبة");
			}

			let finalResourceUrl = form.resourceUrl.trim();
			if (!finalResourceUrl) {
				if (!selectedPdfFile) {
					throw new Error("أدخل رابط المحتوى أو ارفع ملف PDF");
				}
				finalResourceUrl = await uploadStudyMaterialPdf(selectedPdfFile);
			}

			let parsed: URL;
			try {
				parsed = new URL(finalResourceUrl);
			} catch {
				throw new Error("الرابط غير صالح");
			}

			if (!(parsed.protocol === "http:" || parsed.protocol === "https:")) {
				throw new Error("الرابط يجب أن يبدأ بـ http أو https");
			}

			const finalBackupUrl = form.resourceUrlBackup.trim();
			if (finalBackupUrl) {
				let backupParsed: URL;
				try {
					backupParsed = new URL(finalBackupUrl);
				} catch {
					throw new Error("الرابط الاحتياطي غير صالح");
				}

				if (!(backupParsed.protocol === "http:" || backupParsed.protocol === "https:")) {
					throw new Error("الرابط الاحتياطي يجب أن يبدأ بـ http أو https");
				}
			}

			await createStudyMaterial({
				ownerId: user.id,
				university: form.university,
				faculty: form.faculty,
				studyYear: form.studyYear,
				term: form.term,
				courseName: form.courseName,
				materialType: form.materialType,
				title: form.title,
				description: form.description,
				resourceUrl: finalResourceUrl,
				resourceUrlBackup: finalBackupUrl || undefined,
			});
		},
		onSuccess: () => {
			toast.success("تم إضافة المصدر الدراسي بنجاح");
			setOpen(false);
			setSelectedPdfFile(null);
			setForm((prev) => ({ ...prev, courseName: "", title: "", description: "", resourceUrl: "", resourceUrlBackup: "" }));
			queryClient.invalidateQueries({ queryKey: ["study-materials"] });
		},
		onError: (error: unknown) => {
			const message = error instanceof Error ? error.message : "حدث خطأ أثناء الإضافة";
			if (message.toLowerCase().includes("duplicate study material resource link")) {
				toast.error("هذا الرابط مضاف بالفعل لنفس الجامعة/الكلية/الفرقة/الترم/المادة");
				return;
			}
			toast.error(message);
		},
	});

	const voteMutation = useMutation({
		mutationFn: ({ materialId, vote }: { materialId: string; vote: -1 | 1 }) => voteStudyMaterial(materialId, vote),
		onSuccess: (result, variables) => {
			queryClient.setQueryData<StudyMaterialWithMeta[]>(queryKey, (old) => {
				if (!old) return old;
				return old
					.map((item) => {
						if (item.id !== variables.materialId) return item;
						return {
							...item,
							upvotes: result.upvotes,
							downvotes: result.downvotes,
							score: result.score,
							user_vote: result.user_vote,
						};
					})
					.sort((left, right) => {
						if (right.score !== left.score) return right.score - left.score;
						return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
					});
			});
		},
		onError: (error: unknown) => {
			toast.error(error instanceof Error ? error.message : "تعذر تسجيل التقييم");
		},
	});

	const favoriteMutation = useMutation({
		mutationFn: async ({ materialId, isFavorite }: { materialId: string; isFavorite: boolean }) => {
			if (!user?.id) throw new Error("يجب تسجيل الدخول أولاً");
			if (isFavorite) {
				await removeStudyMaterialFavorite(materialId, user.id);
				return false;
			}
			await addStudyMaterialFavorite(materialId, user.id);
			return true;
		},
		onSuccess: (nextIsFavorite, variables) => {
			queryClient.setQueryData<StudyMaterialWithMeta[]>(queryKey, (old) => {
				if (!old) return old;
				return old.map((item) => item.id === variables.materialId ? { ...item, is_favorite: nextIsFavorite } : item);
			});
			toast.success(nextIsFavorite ? "تم الحفظ في المفضلة" : "تمت الإزالة من المفضلة");
		},
		onError: (error: unknown) => {
			const message = error instanceof Error ? error.message : "تعذر تحديث المفضلة";
			if (message.toLowerCase().includes("duplicate") || message.toLowerCase().includes("unique")) {
				toast.info("هذا المحتوى محفوظ بالفعل");
				return;
			}
			toast.error(message);
		},
	});

	const viewMutation = useMutation({
		mutationFn: async (materialId: string) => {
			if (!user?.id) return;
			await recordStudyMaterialView(materialId, user.id);
		},
		onSuccess: (_, materialId) => {
			queryClient.setQueryData<StudyMaterialWithMeta[]>(queryKey, (old) => {
				if (!old) return old;
				const now = new Date().toISOString();
				return old.map((item) => item.id === materialId ? { ...item, viewed_at: now } : item);
			});
		},
	});

	const reportMutation = useMutation({
		mutationFn: ({ materialId, reason }: { materialId: string; reason?: string }) => {
			if (!user?.id) throw new Error("يجب تسجيل الدخول أولاً");
			return reportStudyMaterial({
				materialId,
				reporterId: user.id,
				reason,
			});
		},
		onSuccess: () => {
			toast.success("تم إرسال البلاغ للمراجعة");
		},
		onError: (error: unknown) => {
			const message = error instanceof Error ? error.message : "تعذر إرسال البلاغ";
			if (message.toLowerCase().includes("duplicate") || message.toLowerCase().includes("unique")) {
				toast.info("لقد قمت بالإبلاغ عن هذا المحتوى مسبقًا");
				return;
			}
			toast.error(message);
		},
	});

	const updateMutation = useMutation({
		mutationFn: ({ materialId, title, description, resourceUrl, resourceUrlBackup }: {
			materialId: string;
			title: string;
			description: string;
			resourceUrl: string;
			resourceUrlBackup?: string;
		}) =>
			updateStudyMaterial({ materialId, title, description, resourceUrl, resourceUrlBackup }),
		onSuccess: () => {
			toast.success("تم تحديث المحتوى بنجاح");
			queryClient.invalidateQueries({ queryKey: ["study-materials"] });
		},
		onError: (error: unknown) => {
			const message = error instanceof Error ? error.message : "تعذر تحديث المحتوى";
			if (message.toLowerCase().includes("duplicate study material resource link")) {
				toast.error("لا يمكن التحديث لأن نفس الرابط موجود مسبقًا داخل نفس النطاق الدراسي");
				return;
			}
			toast.error(message);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (materialId: string) => deleteStudyMaterial(materialId),
		onSuccess: () => {
			toast.success("تم حذف المحتوى");
			queryClient.invalidateQueries({ queryKey: ["study-materials"] });
		},
		onError: (error: unknown) => {
			toast.error(error instanceof Error ? error.message : "تعذر حذف المحتوى");
		},
	});

	const handleFormUniversityChange = (university: string) => {
		const nextFaculties = universityFacultiesMap[university] ?? [];
		setForm((prev) => ({
			...prev,
			university,
			faculty: nextFaculties.includes(prev.faculty) ? prev.faculty : (nextFaculties[0] ?? ""),
		}));
	};

	const handleFilterUniversityChange = (university: string) => {
		const nextFaculties = university === "all"
			? Array.from(new Set(Object.values(universityFacultiesMap).flat()))
			: (universityFacultiesMap[university] ?? []);

		setFilters((prev) => ({
			...prev,
			university,
			faculty: prev.faculty && prev.faculty !== "all" && !nextFaculties.includes(prev.faculty)
				? "all"
				: prev.faculty,
		}));
	};

	const handleReport = (materialId: string) => {
		if (!user?.id) {
			toast.error("يجب تسجيل الدخول لإرسال بلاغ");
			return;
		}

		const reason = window.prompt("اكتب سبب البلاغ (اختياري):") ?? undefined;
		reportMutation.mutate({ materialId, reason });
	};

	const handleEditMaterial = (material: StudyMaterialWithMeta) => {
		if (!user?.id || material.owner_id !== user.id) return;

		const newTitle = window.prompt("عنوان المحتوى الجديد:", material.title);
		if (newTitle === null) return;
		if (!newTitle.trim()) {
			toast.error("العنوان لا يمكن أن يكون فارغًا");
			return;
		}

		const newResourceUrl = window.prompt("رابط المحتوى الجديد:", material.resource_url);
		if (newResourceUrl === null) return;
		if (!newResourceUrl.trim()) {
			toast.error("الرابط لا يمكن أن يكون فارغًا");
			return;
		}

		let parsed: URL;
		try {
			parsed = new URL(newResourceUrl.trim());
		} catch {
			toast.error("الرابط غير صالح");
			return;
		}

		if (!(parsed.protocol === "http:" || parsed.protocol === "https:")) {
			toast.error("الرابط يجب أن يبدأ بـ http أو https");
			return;
		}

		const newBackupUrl = window.prompt("رابط احتياطي (اختياري):", material.resource_url_backup ?? "");
		if (newBackupUrl === null) return;

		const backupTrimmed = newBackupUrl.trim();
		if (backupTrimmed) {
			let backupParsed: URL;
			try {
				backupParsed = new URL(backupTrimmed);
			} catch {
				toast.error("الرابط الاحتياطي غير صالح");
				return;
			}

			if (!(backupParsed.protocol === "http:" || backupParsed.protocol === "https:")) {
				toast.error("الرابط الاحتياطي يجب أن يبدأ بـ http أو https");
				return;
			}
		}

		const newDescription = window.prompt("الوصف الجديد (اختياري):", material.description ?? "");
		if (newDescription === null) return;

		updateMutation.mutate({
			materialId: material.id,
			title: newTitle,
			description: newDescription,
			resourceUrl: newResourceUrl,
			resourceUrlBackup: backupTrimmed,
		});
	};

	const handleDeleteMaterial = (material: StudyMaterialWithMeta) => {
		if (!user?.id || material.owner_id !== user.id) return;
		const confirmed = window.confirm("هل أنت متأكد من حذف هذا المحتوى؟");
		if (!confirmed) return;
		deleteMutation.mutate(material.id);
	};

	const handleToggleFavorite = (material: StudyMaterialWithMeta) => {
		if (!user?.id) {
			toast.error("يجب تسجيل الدخول لاستخدام المفضلة");
			return;
		}
		favoriteMutation.mutate({ materialId: material.id, isFavorite: material.is_favorite });
	};

	const handleOpenResource = (material: StudyMaterialWithMeta) => {
		if (user?.id) {
			viewMutation.mutate(material.id);
		}

		const popup = window.open("about:blank", "_blank", "noopener,noreferrer");
		if (!popup) {
			toast.error("المتصفح منع فتح الرابط. اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى");
			return;
		}

		const primaryUrl = material.resource_url;
		const backupUrl = material.resource_url_backup?.trim() ?? "";

		if (!backupUrl) {
			popup.location.href = primaryUrl;
			return;
		}

		popup.document.title = "جاري فتح الملف";
		popup.document.body.innerHTML = "<p style='font-family: sans-serif; padding: 16px; direction: rtl;'>جاري تجهيز الملف...</p>";

		void (async () => {
			try {
				const probe = await fetch(primaryUrl, { method: "HEAD" });
				if (probe.ok) {
					popup.location.href = primaryUrl;
					return;
				}

				popup.location.href = backupUrl;
				toast.info("تم فتح النسخة الاحتياطية لأن الرابط الأساسي غير متاح");
			} catch {
				popup.location.href = primaryUrl;
				toast.message("لو الملف لم يفتح، سيتم استخدام الرابط الاحتياطي من التعديل القادم");
			}
		})();
	};

	const handleOpenPreview = (material: StudyMaterialWithMeta) => {
		if (user?.id) {
			viewMutation.mutate(material.id);
		}
	};

	const visibleMaterials = useMemo(() => {
		let base = materials;

		if (viewMode === "saved") {
			base = base.filter((material) => material.is_favorite);
		} else if (viewMode === "recent") {
			base = base
				.filter((material) => !!material.viewed_at)
				.sort((left, right) => new Date(right.viewed_at ?? 0).getTime() - new Date(left.viewed_at ?? 0).getTime());
		}

		if (resourceSourceFilter !== "all") {
			base = base.filter((material) => {
				const source = getResourceSourceLabel(material.resource_url).toLowerCase();
				if (resourceSourceFilter === "youtube") return source === "youtube";
				if (resourceSourceFilter === "drive") return source === "google drive";
				if (resourceSourceFilter === "onedrive") return source === "onedrive";
				if (resourceSourceFilter === "telegram") return source === "telegram";
				return source === "رابط خارجي";
			});
		}

		if (viewMode === "recent") {
			return base;
		}

		if (sortMode === "newest") {
			return [...base].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
		}

		if (sortMode === "top") {
			return [...base].sort((left, right) => {
				if (right.score !== left.score) return right.score - left.score;
				return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
			});
		}

		return base;
	}, [materials, viewMode, resourceSourceFilter, sortMode]);

	const handleClearAllFilters = () => {
		setFilters({
			university: "all",
			faculty: "all",
			studyYear: "all",
			term: "all",
			courseName: "",
			materialType: "all",
		});
		setViewMode("all");
		setResourceSourceFilter("all");
		setSortMode("smart");
	};

	const handlePdfSelection = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0] ?? null;
		if (!file) {
			setSelectedPdfFile(null);
			return;
		}

		if (file.type !== "application/pdf") {
			toast.error("يمكن رفع ملفات PDF فقط");
			event.target.value = "";
			setSelectedPdfFile(null);
			return;
		}

		setSelectedPdfFile(file);
		setForm((prev) => ({ ...prev, resourceUrl: "" }));
	};

	return (
		<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-4" dir="rtl">
			<div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-navy/20 bg-card p-5 shadow-hard">
				<div className="text-right">
					<h1 className="text-4xl font-black tracking-tight text-primary">بنك المحاضرات والملخصات</h1>
					<p className="text-xs font-semibold text-muted-foreground">ابحث حسب الجامعة والكلية والفرقة والترم والمادة، بترتيب ذكي يجمع الجودة والحداثة</p>
				</div>

				<Dialog open={open} onOpenChange={setOpen}>
					<DialogTrigger asChild>
						<Button variant="cta" className="rounded-2xl px-6">
							<Plus className="h-4 w-4" />
							أضف محتوى
						</Button>
					</DialogTrigger>
					<DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl border-navy/20 bg-card" dir="rtl">
						<DialogHeader>
							<DialogTitle className="text-right text-2xl font-black text-primary">إضافة مصدر دراسي جديد</DialogTitle>
							<DialogDescription className="text-right">
								أضف رابط مباشر، أو ارفع PDF وسنحوّله تلقائيًا لرابط خارجي بدون استهلاك مساحة قاعدة البيانات. الحد اليومي: 3 ملفات لكل طالب.
							</DialogDescription>
						</DialogHeader>

						<div className="grid gap-4 pt-2">
							<div className="grid gap-2">
								<Label>الجامعة</Label>
								<Select value={form.university} onValueChange={handleFormUniversityChange}>
									<SelectTrigger><SelectValue /></SelectTrigger>
									<SelectContent>{universities.map((university) => <SelectItem key={university} value={university}>{university}</SelectItem>)}</SelectContent>
								</Select>
							</div>

							<div className="grid gap-2">
								<Label>الكلية</Label>
								<Select value={form.faculty} onValueChange={(value) => setForm((prev) => ({ ...prev, faculty: value }))}>
									<SelectTrigger><SelectValue /></SelectTrigger>
									<SelectContent>{formFacultyOptions.map((faculty) => <SelectItem key={faculty} value={faculty}>{faculty}</SelectItem>)}</SelectContent>
								</Select>
							</div>

							<div className="grid grid-cols-2 gap-3">
								<div className="grid gap-2">
									<Label>الفرقة</Label>
									<Select value={form.studyYear} onValueChange={(value) => setForm((prev) => ({ ...prev, studyYear: value }))}>
										<SelectTrigger><SelectValue /></SelectTrigger>
										<SelectContent>{years.map((year) => <SelectItem key={year} value={year}>{year}</SelectItem>)}</SelectContent>
									</Select>
								</div>
								<div className="grid gap-2">
									<Label>الترم</Label>
									<Select value={form.term} onValueChange={(value) => setForm((prev) => ({ ...prev, term: value }))}>
										<SelectTrigger><SelectValue /></SelectTrigger>
										<SelectContent>{terms.map((term) => <SelectItem key={term} value={term}>{term}</SelectItem>)}</SelectContent>
									</Select>
								</div>
							</div>

							<Input
								value={form.courseName}
								onChange={(event) => setForm((prev) => ({ ...prev, courseName: event.target.value }))}
								placeholder="اسم المادة"
							/>

							<div className="grid gap-2">
								<Label>التصنيف</Label>
								<Select value={form.materialType} onValueChange={(value) => setForm((prev) => ({ ...prev, materialType: value as StudyMaterialType }))}>
									<SelectTrigger><SelectValue /></SelectTrigger>
									<SelectContent>
										{materialTypeOptions.map((option) => (
											<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<Input
								value={form.title}
								onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
								placeholder="عنوان المحتوى"
							/>

							<Textarea
								value={form.description}
								onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
								placeholder="وصف مختصر (اختياري)"
								className="min-h-[90px]"
							/>

							<Input
								value={form.resourceUrl}
								onChange={(event) => setForm((prev) => ({ ...prev, resourceUrl: event.target.value }))}
								placeholder="رابط YouTube أو رابط خارجي للمحتوى (اختياري لو هترفع PDF)"
								dir="ltr"
							/>

							<Input
								value={form.resourceUrlBackup}
								onChange={(event) => setForm((prev) => ({ ...prev, resourceUrlBackup: event.target.value }))}
								placeholder="رابط احتياطي (اختياري - مثال Google Drive)"
								dir="ltr"
							/>

							<div className="rounded-2xl border border-dashed border-navy/30 bg-muted/30 p-3">
								<Label className="mb-2 block">أو ارفع ملف PDF مباشرة</Label>
								<div className="flex flex-wrap items-center gap-2">
									<label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-input bg-background px-3 py-2 text-sm hover:bg-accent">
										<Upload className="h-4 w-4" />
										اختر ملف PDF
										<input type="file" accept="application/pdf,.pdf" className="hidden" onChange={handlePdfSelection} />
									</label>
									{selectedPdfFile && <span className="text-xs text-muted-foreground">{selectedPdfFile.name}</span>}
								</div>
							</div>

							<Button onClick={() => createMaterialMutation.mutate()} disabled={createMaterialMutation.isPending} className="rounded-2xl font-bold">
								{createMaterialMutation.isPending ? "جاري الإضافة..." : "حفظ المصدر"}
							</Button>
						</div>
					</DialogContent>
				</Dialog>
			</div>

			<Card className="rounded-3xl border-navy/20 bg-card/95 shadow-hard-sm">
				<CardHeader>
					<div className="flex items-center justify-between gap-2">
						<div className="flex flex-wrap items-center gap-2">
							<Button
								variant={viewMode === "all" ? "default" : "outline"}
								size="sm"
								onClick={() => setViewMode("all")}
							>
								الكل
							</Button>
							<Button
								variant={viewMode === "saved" ? "default" : "outline"}
								size="sm"
								onClick={() => setViewMode("saved")}
								className="gap-1"
							>
								<BookmarkCheck className="h-4 w-4" /> المفضلة
							</Button>
							<Button
								variant={viewMode === "recent" ? "default" : "outline"}
								size="sm"
								onClick={() => setViewMode("recent")}
							>
								آخر ما شاهدته
							</Button>
							<Button variant="ghost" size="sm" onClick={handleClearAllFilters}>
								Clear All
							</Button>
						</div>
						<CardTitle className="text-right text-lg">فلاتر البحث</CardTitle>
					</div>
				</CardHeader>
				<CardContent className="grid gap-3 md:grid-cols-8">
					<Select value={filters.university || "all"} onValueChange={handleFilterUniversityChange}>
						<SelectTrigger><SelectValue placeholder="الجامعة" /></SelectTrigger>
						<SelectContent>
							<SelectItem value="all">كل الجامعات</SelectItem>
							{universities.map((university) => <SelectItem key={university} value={university}>{university}</SelectItem>)}
						</SelectContent>
					</Select>

					<Select value={filters.faculty || "all"} onValueChange={(value) => setFilters((prev) => ({ ...prev, faculty: value }))}>
						<SelectTrigger><SelectValue placeholder="الكلية" /></SelectTrigger>
						<SelectContent>
							<SelectItem value="all">كل الكليات</SelectItem>
							{filterFacultyOptions.map((faculty) => <SelectItem key={faculty} value={faculty}>{faculty}</SelectItem>)}
						</SelectContent>
					</Select>

					<Select value={filters.studyYear || "all"} onValueChange={(value) => setFilters((prev) => ({ ...prev, studyYear: value }))}>
						<SelectTrigger><SelectValue placeholder="الفرقة" /></SelectTrigger>
						<SelectContent>
							<SelectItem value="all">كل الفرق</SelectItem>
							{years.map((year) => <SelectItem key={year} value={year}>{year}</SelectItem>)}
						</SelectContent>
					</Select>

					<Select value={filters.term || "all"} onValueChange={(value) => setFilters((prev) => ({ ...prev, term: value }))}>
						<SelectTrigger><SelectValue placeholder="الترم" /></SelectTrigger>
						<SelectContent>
							<SelectItem value="all">كل التيرمات</SelectItem>
							{terms.map((term) => <SelectItem key={term} value={term}>{term}</SelectItem>)}
						</SelectContent>
					</Select>

					<Select
						value={(filters.materialType as string) || "all"}
						onValueChange={(value) => setFilters((prev) => ({ ...prev, materialType: value as StudyMaterialType | "all" }))}
					>
						<SelectTrigger><SelectValue placeholder="التصنيف" /></SelectTrigger>
						<SelectContent>
							<SelectItem value="all">كل التصنيفات</SelectItem>
							{materialTypeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
						</SelectContent>
					</Select>

					<Select value={resourceSourceFilter} onValueChange={(value) => setResourceSourceFilter(value as ResourceSourceFilter)}>
						<SelectTrigger><SelectValue placeholder="نوع الرابط" /></SelectTrigger>
						<SelectContent>
							<SelectItem value="all">كل الروابط</SelectItem>
							<SelectItem value="youtube">YouTube</SelectItem>
							<SelectItem value="drive">Google Drive</SelectItem>
							<SelectItem value="onedrive">OneDrive</SelectItem>
							<SelectItem value="telegram">Telegram</SelectItem>
							<SelectItem value="other">روابط أخرى</SelectItem>
						</SelectContent>
					</Select>

					<Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
						<SelectTrigger><SelectValue placeholder="الترتيب" /></SelectTrigger>
						<SelectContent>
							<SelectItem value="smart">الترتيب الذكي</SelectItem>
							<SelectItem value="newest">الأحدث</SelectItem>
							<SelectItem value="top">الأعلى تقييمًا</SelectItem>
						</SelectContent>
					</Select>

					<div className="relative">
						<Search className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="بحث باسم المادة"
							value={filters.courseName || ""}
							onChange={(event) => setFilters((prev) => ({ ...prev, courseName: event.target.value }))}
							className="pr-9"
						/>
					</div>
				</CardContent>
			</Card>

			<div className="grid gap-4">
				{isLoading ? (
					<Card className="rounded-3xl border-navy/20 bg-card p-6 text-center text-muted-foreground">جاري تحميل المحتوى...</Card>
				) : visibleMaterials.length === 0 ? (
					<Card className="rounded-3xl border-navy/20 bg-card p-8 text-center">
						<FileText className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
						<p className="font-semibold text-muted-foreground">
							{viewMode === "saved"
								? "لا يوجد محتوى محفوظ في المفضلة"
								: viewMode === "recent"
									? "لا يوجد محتوى في آخر ما شاهدته"
									: "لا يوجد محتوى حالياً بهذه الفلاتر"}
						</p>
					</Card>
				) : (
					visibleMaterials.map((material) => {
						const youtubeVideoId = getYouTubeVideoId(material.resource_url);

						return (
						<Card key={material.id} className="rounded-3xl border-navy/20 bg-card/95 shadow-hard-sm">
							<CardHeader className="space-y-3">
								<div className="flex flex-wrap items-center gap-2">
									<Badge variant="outline">{material.university}</Badge>
									<Badge variant="outline">{material.faculty}</Badge>
									<Badge variant="outline">{material.study_year}</Badge>
									<Badge variant="outline">{material.term}</Badge>
									<Badge>{materialTypeLabelMap[material.material_type as StudyMaterialType] ?? material.material_type}</Badge>
									<Badge variant="secondary">{getResourceSourceLabel(material.resource_url)}</Badge>
								</div>
								{youtubeVideoId && (
									<div className="relative overflow-hidden rounded-2xl border border-navy/20">
										<img
											src={`https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`}
											alt={`معاينة فيديو ${material.title}`}
											className="h-48 w-full object-cover"
											loading="lazy"
										/>
										<div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
											<PlayCircle className="h-14 w-14 text-white drop-shadow" />
										</div>
									</div>
								)}
								<CardTitle className="text-right text-xl">{material.title}</CardTitle>
								<p className="text-right text-sm text-muted-foreground">المادة: {material.course_name}</p>
								{material.description && <p className="text-right text-sm leading-relaxed text-muted-foreground">{material.description}</p>}
							</CardHeader>

							<CardContent className="flex flex-wrap items-center justify-between gap-2">
								<div className="flex items-center gap-2">
									<Button
										variant={material.user_vote === 1 ? "default" : "outline"}
										size="sm"
										onClick={() => voteMutation.mutate({ materialId: material.id, vote: 1 })}
										disabled={voteMutation.isPending}
										className="gap-1"
									>
										<ArrowUp className="h-4 w-4" /> {material.upvotes}
									</Button>
									<Button
										variant={material.user_vote === -1 ? "destructive" : "outline"}
										size="sm"
										onClick={() => voteMutation.mutate({ materialId: material.id, vote: -1 })}
										disabled={voteMutation.isPending}
										className="gap-1"
									>
										<ArrowDown className="h-4 w-4" /> {material.downvotes}
									</Button>
									<Badge variant="secondary">النقاط: {material.score}</Badge>
								</div>

								<div className="flex items-center gap-2">
										<Button
											variant="ghost"
											size="sm"
											onClick={() => handleToggleFavorite(material)}
											disabled={favoriteMutation.isPending}
											className="gap-1 text-muted-foreground hover:text-primary"
										>
											{material.is_favorite ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />} {material.is_favorite ? "محفوظ" : "حفظ"}
										</Button>

										{user?.id === material.owner_id && (
											<>
												<Button
													variant="ghost"
													size="sm"
													onClick={() => handleEditMaterial(material)}
													disabled={updateMutation.isPending}
													className="gap-1 text-muted-foreground hover:text-primary"
												>
													<Pencil className="h-4 w-4" /> تعديل
												</Button>

												<Button
													variant="ghost"
													size="sm"
													onClick={() => handleDeleteMaterial(material)}
													disabled={deleteMutation.isPending}
													className="gap-1 text-muted-foreground hover:text-destructive"
												>
													<Trash2 className="h-4 w-4" /> حذف
												</Button>
											</>
										)}

										<Button
											variant="ghost"
											size="sm"
											onClick={() => handleReport(material.id)}
											disabled={reportMutation.isPending}
											className="gap-1 text-muted-foreground hover:text-destructive"
										>
											<Flag className="h-4 w-4" /> تبليغ
										</Button>

									{youtubeVideoId && (
										<Dialog>
											<DialogTrigger asChild>
												<Button variant="secondary" size="sm" className="gap-1" onClick={() => handleOpenPreview(material)}>
													معاينة الفيديو <PlayCircle className="h-4 w-4" />
												</Button>
											</DialogTrigger>
											<DialogContent className="max-w-3xl rounded-3xl border-navy/20 bg-card" dir="rtl">
												<DialogHeader>
													<DialogTitle className="text-right">{material.title}</DialogTitle>
													<DialogDescription className="text-right">
														معاينة سريعة لفيديو YouTube بدون مغادرة الصفحة.
													</DialogDescription>
												</DialogHeader>
												<div className="overflow-hidden rounded-2xl border border-navy/20">
													<iframe
														title={`youtube-preview-${material.id}`}
														className="h-[360px] w-full"
														src={`https://www.youtube.com/embed/${youtubeVideoId}`}
														allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
														allowFullScreen
													/>
												</div>
											</DialogContent>
										</Dialog>
									)}

									<Button variant="outline" size="sm" className="gap-1" onClick={() => handleOpenResource(material)}>
										فتح الرابط <ExternalLink className="h-4 w-4" />
									</Button>
								</div>
							</CardContent>
						</Card>
						);
					})
				)}
			</div>
		</motion.div>
	);
}
