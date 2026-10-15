"use client";
import { useI18n } from "@/i18n";
import { ButtonLink, Card, EmptyState } from "@/components/ui";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <Card>
        <EmptyState title={t("common.notFound.title")} body={t("common.notFound.body")} action={<ButtonLink href="/">{t("common.backHome")}</ButtonLink>} />
      </Card>
    </div>
  );
}
