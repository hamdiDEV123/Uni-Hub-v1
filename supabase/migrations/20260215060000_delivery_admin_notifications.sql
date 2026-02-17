-- Delivery: notifications wiring + admin full access

-- 1) Admin full access on delivery tables
DROP POLICY IF EXISTS "delivery_admin_full_access_orders" ON public.delivery_orders;
CREATE POLICY "delivery_admin_full_access_orders"
ON public.delivery_orders
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "delivery_admin_full_access_offers" ON public.delivery_offers;
CREATE POLICY "delivery_admin_full_access_offers"
ON public.delivery_offers
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "delivery_admin_full_access_messages" ON public.delivery_messages;
CREATE POLICY "delivery_admin_full_access_messages"
ON public.delivery_messages
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "delivery_admin_full_access_tracking" ON public.delivery_tracking_points;
CREATE POLICY "delivery_admin_full_access_tracking"
ON public.delivery_tracking_points
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "delivery_admin_full_access_verifications" ON public.delivery_verifications;
CREATE POLICY "delivery_admin_full_access_verifications"
ON public.delivery_verifications
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Keep existing user policies, but allow admin in them too for safer behavior.
DROP POLICY IF EXISTS "delivery_orders_select_related_or_open" ON public.delivery_orders;
CREATE POLICY "delivery_orders_select_related_or_open"
ON public.delivery_orders
FOR SELECT TO authenticated
USING (
  auth.uid() = requester_id
  OR auth.uid() = runner_id
  OR status = 'open'
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "delivery_orders_insert_requester_only" ON public.delivery_orders;
CREATE POLICY "delivery_orders_insert_requester_only"
ON public.delivery_orders
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = requester_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "delivery_orders_update_related_users" ON public.delivery_orders;
CREATE POLICY "delivery_orders_update_related_users"
ON public.delivery_orders
FOR UPDATE TO authenticated
USING (auth.uid() = requester_id OR auth.uid() = runner_id OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = requester_id OR auth.uid() = runner_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "delivery_offers_select_related" ON public.delivery_offers;
CREATE POLICY "delivery_offers_select_related"
ON public.delivery_offers
FOR SELECT TO authenticated
USING (
  auth.uid() = runner_id
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.delivery_orders o
    WHERE o.id = order_id AND (o.requester_id = auth.uid() OR o.runner_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "delivery_offers_insert_runner_only" ON public.delivery_offers;
CREATE POLICY "delivery_offers_insert_runner_only"
ON public.delivery_offers
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (
    auth.uid() = runner_id
    AND EXISTS (
      SELECT 1 FROM public.delivery_orders o
      WHERE o.id = order_id AND o.status = 'open'
    )
  )
);

DROP POLICY IF EXISTS "delivery_offers_update_runner_or_requester" ON public.delivery_offers;
CREATE POLICY "delivery_offers_update_runner_or_requester"
ON public.delivery_offers
FOR UPDATE TO authenticated
USING (
  auth.uid() = runner_id
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.delivery_orders o
    WHERE o.id = order_id AND o.requester_id = auth.uid()
  )
)
WITH CHECK (
  auth.uid() = runner_id
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.delivery_orders o
    WHERE o.id = order_id AND o.requester_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "delivery_messages_select_related" ON public.delivery_messages;
CREATE POLICY "delivery_messages_select_related"
ON public.delivery_messages
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.delivery_orders o
    WHERE o.id = order_id
      AND (o.requester_id = auth.uid() OR o.runner_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "delivery_messages_insert_related" ON public.delivery_messages;
CREATE POLICY "delivery_messages_insert_related"
ON public.delivery_messages
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.delivery_orders o
      WHERE o.id = order_id
        AND (o.requester_id = auth.uid() OR o.runner_id = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "delivery_tracking_select_related" ON public.delivery_tracking_points;
CREATE POLICY "delivery_tracking_select_related"
ON public.delivery_tracking_points
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.delivery_orders o
    WHERE o.id = order_id
      AND (o.requester_id = auth.uid() OR o.runner_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "delivery_tracking_insert_runner_only" ON public.delivery_tracking_points;
CREATE POLICY "delivery_tracking_insert_runner_only"
ON public.delivery_tracking_points
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (
    auth.uid() = runner_id
    AND EXISTS (
      SELECT 1 FROM public.delivery_orders o
      WHERE o.id = order_id AND o.runner_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "delivery_verifications_select_related" ON public.delivery_verifications;
CREATE POLICY "delivery_verifications_select_related"
ON public.delivery_verifications
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.delivery_orders o
    WHERE o.id = order_id
      AND (o.requester_id = auth.uid() OR o.runner_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "delivery_verifications_insert_related_actor" ON public.delivery_verifications;
CREATE POLICY "delivery_verifications_insert_related_actor"
ON public.delivery_verifications
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (
    auth.uid() = actor_id
    AND EXISTS (
      SELECT 1 FROM public.delivery_orders o
      WHERE o.id = order_id
        AND (o.requester_id = auth.uid() OR o.runner_id = auth.uid())
    )
  )
);

-- 2) Admin read/write access to notifications table
DROP POLICY IF EXISTS "Admins can view all notifications" ON public.notifications;
CREATE POLICY "Admins can view all notifications"
ON public.notifications
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage all notifications" ON public.notifications;
CREATE POLICY "Admins can manage all notifications"
ON public.notifications
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) Delivery events -> notifications
CREATE OR REPLACE FUNCTION public.create_system_notification(
  _user_id UUID,
  _title TEXT,
  _message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (_user_id, _title, _message, 'System');
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_delivery_offer_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester UUID;
BEGIN
  SELECT requester_id INTO v_requester
  FROM public.delivery_orders
  WHERE id = NEW.order_id;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.create_system_notification(
      v_requester,
      'عرض جديد على طلبك',
      'تم استلام عرض جديد على طلب التوصيل.'
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'accepted' THEN
      PERFORM public.create_system_notification(
        NEW.runner_id,
        'تم قبول عرضك',
        'صاحب الطلب قبل عرضك. يمكنك بدء التنفيذ الآن.'
      );
    ELSIF NEW.status = 'rejected' THEN
      PERFORM public.create_system_notification(
        NEW.runner_id,
        'تم رفض العرض',
        'صاحب الطلب اختار عرضًا آخر.'
      );
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_delivery_order_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.runner_id IS DISTINCT FROM NEW.runner_id AND NEW.runner_id IS NOT NULL THEN
      PERFORM public.create_system_notification(
        NEW.runner_id,
        'تم إسناد طلب لك',
        'تم اختيارك كرانر لهذا الطلب.'
      );
    END IF;

    IF OLD.status IS DISTINCT FROM NEW.status THEN
      PERFORM public.create_system_notification(
        NEW.requester_id,
        'تحديث حالة الطلب',
        'حالة طلبك أصبحت: ' || NEW.status::TEXT
      );

      PERFORM public.create_system_notification(
        NEW.runner_id,
        'تحديث حالة الطلب',
        'حالة الطلب أصبحت: ' || NEW.status::TEXT
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_delivery_message_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester UUID;
  v_runner UUID;
  v_target UUID;
BEGIN
  SELECT requester_id, runner_id INTO v_requester, v_runner
  FROM public.delivery_orders
  WHERE id = NEW.order_id;

  IF NEW.sender_id = v_requester THEN
    v_target := v_runner;
  ELSE
    v_target := v_requester;
  END IF;

  PERFORM public.create_system_notification(
    v_target,
    'رسالة جديدة في طلب التوصيل',
    'لديك رسالة جديدة داخل شات الطلب.'
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_delivery_verification_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester UUID;
BEGIN
  IF NEW.type = 'pickup_selfie' THEN
    SELECT requester_id INTO v_requester
    FROM public.delivery_orders
    WHERE id = NEW.order_id;

    PERFORM public.create_system_notification(
      v_requester,
      'سيلفي أمان جديد',
      'الرانر أرسل سيلفي التحقق لهذا الطلب.'
    );
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_notify_delivery_offer_event_insert') THEN
    CREATE TRIGGER tr_notify_delivery_offer_event_insert
    AFTER INSERT ON public.delivery_offers
    FOR EACH ROW EXECUTE FUNCTION public.notify_delivery_offer_event();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_notify_delivery_offer_event_update') THEN
    CREATE TRIGGER tr_notify_delivery_offer_event_update
    AFTER UPDATE ON public.delivery_offers
    FOR EACH ROW EXECUTE FUNCTION public.notify_delivery_offer_event();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_notify_delivery_order_event') THEN
    CREATE TRIGGER tr_notify_delivery_order_event
    AFTER UPDATE ON public.delivery_orders
    FOR EACH ROW EXECUTE FUNCTION public.notify_delivery_order_event();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_notify_delivery_message_event') THEN
    CREATE TRIGGER tr_notify_delivery_message_event
    AFTER INSERT ON public.delivery_messages
    FOR EACH ROW EXECUTE FUNCTION public.notify_delivery_message_event();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_notify_delivery_verification_event') THEN
    CREATE TRIGGER tr_notify_delivery_verification_event
    AFTER INSERT ON public.delivery_verifications
    FOR EACH ROW EXECUTE FUNCTION public.notify_delivery_verification_event();
  END IF;
END $$;

