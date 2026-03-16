import React from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

type RouteErrorBoundaryProps = {
  children: React.ReactNode;
  routeName?: string;
};

type RouteErrorBoundaryState = {
  hasError: boolean;
};

export class RouteErrorBoundary extends React.Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("RouteErrorBoundary caught an error:", error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        dir="rtl"
        className="flex min-h-[60vh] flex-col items-center justify-center gap-4 rounded-lg border border-border/70 bg-card p-6 text-center"
      >
        <h2 className="text-xl font-bold">حدث خطأ غير متوقع</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {this.props.routeName
            ? `تعذر تحميل صفحة ${this.props.routeName} الآن.`
            : "تعذر تحميل الصفحة الآن."}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={this.handleRetry}>إعادة المحاولة</Button>
          <Link to="/marketplace">
            <Button variant="outline">العودة إلى السوق</Button>
          </Link>
        </div>
      </div>
    );
  }
}
