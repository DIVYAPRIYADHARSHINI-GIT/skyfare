"use client";
import { useEffect } from "react";
import { useI18n } from "@/i18n";
import { Button, ButtonLink, Card, EmptyState } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <Card>
        <EmptyState
          title={t("common.error")}
          body={t("results.error")}
          action={
            <div className="flex gap-2">
              <Button onClick={reset}>{t("results.retry")}</Button>
              <ButtonLink href="/" variant="secondary">
                {t("common.backHome")}
              </ButtonLink>
            </div>
          }
        />
      </Card>
    </div>
  );
}
