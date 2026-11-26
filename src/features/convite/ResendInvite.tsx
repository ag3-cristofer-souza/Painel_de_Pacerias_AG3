import { useMutation } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { Button } from "@/ui/button";
import { ErrorText } from "@/ui/feedback";

/**
 * "Reenviar convite" (adendo ly): para quem ainda não entrou — o convite venceu (7 dias), caiu no spam ou foi apagado. O
 * link novo substitui o anterior.
 */
export function ResendInvite({ email, send }: { email: string; send: () => Promise<void> }) {
  const mutation = useMutation({ mutationFn: send });
  return (
    <div className="space-y-1">
      <Button
        variant="outline"
        loading={mutation.isPending}
        disabled={mutation.isSuccess}
        onClick={() => mutation.mutate()}
      >
        <Mail aria-hidden="true" />
        {mutation.isSuccess ? "Convite reenviado" : "Reenviar convite"}
      </Button>
      {mutation.isSuccess && (
        <p role="status" className="text-xs text-muted-foreground">
          Enviado para {email}. O link anterior deixou de valer; peça para olhar também o spam.
        </p>
      )}
      <ErrorText>{mutation.error?.message}</ErrorText>
    </div>
  );
}
