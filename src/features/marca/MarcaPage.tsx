import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ImageUp, Loader2, Trash2, TriangleAlert } from "lucide-react";
import { useEffect, useId, useState, type ChangeEvent, type FormEvent } from "react";
import { brandApi, type BrandAssetKind, type BrandInput, type PanelBrand } from "@/api/branding";
import { Button } from "@/ui/button";
import { ErrorText } from "@/ui/feedback";
import { Field } from "@/ui/field";
import { PageHeader } from "@/ui/page";

const TEXT_FIELDS = [
  "product_name",
  "color_primary",
  "color_primary_dark",
  "support_email",
  "support_phone",
  "support_url",
  "terms_url",
  "privacy_url",
] as const;
type TextField = (typeof TEXT_FIELDS)[number];
type Draft = Record<TextField | "slug", string>;

const toDraft = (b: PanelBrand): Draft => ({
  slug: b.slug ?? "",
  ...(Object.fromEntries(TEXT_FIELDS.map((k) => [k, b[k] ?? ""])) as Record<TextField, string>),
});

const ASSETS: { kind: BrandAssetKind; label: string; hint: string; dark?: boolean }[] = [
  {
    kind: "logo_light",
    label: "Logo para fundo claro",
    hint: "E-mails e telas claras. PNG com fundo transparente.",
  },
  {
    kind: "logo_dark",
    label: "Logo para fundo escuro",
    hint: "Tela de entrada e menu.",
    dark: true,
  },
  { kind: "favicon", label: "Ícone da aba", hint: "Quadrado, 48 × 48 ou maior." },
  {
    kind: "app_icon",
    label: "Ícone do app",
    hint: "Quadrado, 512 × 512. Vai na tela inicial do celular.",
  },
];

function ColorField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} (seletor)`}
          className="size-12 shrink-0 cursor-pointer rounded-xl border border-input bg-background p-1"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#2563eb"}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
        <input
          id={id}
          className="min-h-12 w-full rounded-xl border border-input bg-background px-3.5 font-mono text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="#RRGGBB"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

function AssetSlot({
  brand,
  kind,
  label,
  hint,
  dark,
}: (typeof ASSETS)[number] & { brand: PanelBrand }) {
  const client = useQueryClient();
  const id = useId();
  const url = brand[kind];
  const upload = useMutation({
    mutationFn: (file: File) => brandApi.upload(kind, file),
    onSuccess: (data) => client.setQueryData(["brand"], data),
  });
  const remove = useMutation({
    mutationFn: () => brandApi.remove(kind),
    onSuccess: (data) => client.setQueryData(["brand"], data),
  });
  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload.mutate(file);
    e.target.value = "";
  };
  const error = upload.error ?? remove.error;
  return (
    <div className="space-y-2 rounded-xl border border-input p-3">
      <p className="text-sm font-medium">{label}</p>
      <div
        className={
          dark
            ? "flex h-20 items-center justify-center rounded-lg bg-slate-900"
            : "flex h-20 items-center justify-center rounded-lg bg-muted"
        }
      >
        {url ? (
          <img src={url} alt={label} className="max-h-16 max-w-[80%] object-contain" />
        ) : (
          <span className={dark ? "text-xs text-white/60" : "text-xs text-muted-foreground"}>
            Sem imagem
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{hint} PNG, JPEG ou WebP, até 2 MB.</p>
      {brand.editable && (
        <div className="flex flex-wrap gap-2">
          <label
            htmlFor={id}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-input bg-card px-3 text-sm font-medium"
          >
            {upload.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ImageUp className="size-4" aria-hidden="true" />
            )}
            {url ? "Trocar" : "Enviar"}
          </label>
          <input
            id={id}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            aria-label={`Enviar ${label.toLowerCase()}`}
            onChange={pick}
          />
          {url && (
            <Button variant="ghost" onClick={() => remove.mutate()} loading={remove.isPending}>
              <Trash2 className="size-4" aria-hidden="true" />
              Tirar
            </Button>
          )}
        </div>
      )}
      {error && <ErrorText>{error.message}</ErrorText>}
    </div>
  );
}

const DOMAIN_PREFIXES = [
  ["app", "Sistema dos clientes"],
  ["m", "App no celular"],
  ["suporte", "Este painel"],
] as const;

/** Domínio próprio (onda 8): o parceiro informa; a AG3 cadastra na Cloudflare e ativa. Até lá, valem os endereços acima. */
function DomainSection({ brand }: { brand: PanelBrand }) {
  const client = useQueryClient();
  const current = brand.custom_domain;
  const [value, setValue] = useState(current?.domain ?? "");
  const mutation = useMutation({
    mutationFn: (domain: string) => brandApi.save({ custom_domain: domain }),
    onSuccess: (data) => {
      client.setQueryData(["brand"], data);
      setValue(data.custom_domain?.domain ?? "");
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate(value.trim());
  };
  return (
    <section className="surface mt-6 space-y-4 p-5" aria-labelledby="dominio-titulo">
      <h2 id="dominio-titulo" className="text-base font-semibold">
        Domínio próprio
      </h2>
      <p className="text-sm text-muted-foreground">
        Use um domínio seu no lugar dos endereços acima. O sistema usa três endereços nele: app., m.
        e suporte. Os endereços acima continuam funcionando.
      </p>
      {brand.editable && (
        <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field
              label="Domínio"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoCapitalize="none"
              placeholder="ex.: lojafacil.com.br"
            />
          </div>
          <Button type="submit" variant="outline" loading={mutation.isPending}>
            {value.trim() ? "Salvar domínio" : "Tirar domínio"}
          </Button>
        </form>
      )}
      {mutation.isError && <ErrorText>{mutation.error.message}</ErrorText>}
      {current && (
        <div className="space-y-3">
          <p
            className={
              current.status === "active"
                ? "flex items-center gap-2 text-sm text-emerald-700"
                : "flex items-center gap-2 text-sm text-amber-700"
            }
            role="status"
          >
            {current.status === "active" ? (
              <CheckCircle2 className="size-4" aria-hidden="true" />
            ) : (
              <TriangleAlert className="size-4" aria-hidden="true" />
            )}
            {current.status === "active"
              ? `Domínio ativo: os seus clientes já podem usar ${current.addresses.painel}.`
              : "Pedido recebido. Crie os registros abaixo no DNS do seu domínio; a nossa equipe confere e ativa."}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Registros de DNS do domínio próprio</caption>
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 pr-4 font-medium">Para</th>
                  <th className="py-1 pr-4 font-medium">Tipo</th>
                  <th className="py-1 pr-4 font-medium">Nome</th>
                  <th className="py-1 font-medium">Destino</th>
                </tr>
              </thead>
              <tbody>
                {DOMAIN_PREFIXES.map(([prefix, label]) => (
                  <tr key={prefix} className="border-t">
                    <td className="py-2 pr-4">{label}</td>
                    <td className="py-2 pr-4">CNAME</td>
                    <td className="py-2 pr-4 font-mono">{prefix}</td>
                    <td className="py-2 font-mono">{current.cname_target}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            O domínio principal ({current.domain}, sem nada na frente) não precisa mudar. O
            certificado do https sai sozinho depois que os registros estiverem certos.
          </p>
        </div>
      )}
    </section>
  );
}

/** Marca do white label (onda 7): endereço, nome, cores, imagens, contato e links. Dono e admin editam. */
export function MarcaPage() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["brand"], queryFn: brandApi.get });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (query.data && draft === null) setDraft(toDraft(query.data));
  }, [query.data, draft]);

  const mutation = useMutation({
    mutationFn: (input: BrandInput) => brandApi.save(input),
    onSuccess: (data) => {
      client.setQueryData(["brand"], data);
      setDraft(toDraft(data));
      setSaved(true);
    },
  });

  if (query.isError) return <ErrorText>{query.error.message}</ErrorText>;
  if (query.isPending || draft === null) {
    return (
      <div className="surface flex justify-center p-10" role="status">
        <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">Carregando a marca</span>
      </div>
    );
  }

  const brand = query.data;
  const editable = brand.editable;
  const original = toDraft(brand);
  const slugChanged = !!original.slug && draft.slug.trim() !== original.slug;

  const set = (key: keyof Draft) => (value: string) => {
    setSaved(false);
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  };
  const onText = (key: keyof Draft) => (e: ChangeEvent<HTMLInputElement>) =>
    set(key)(e.target.value);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSaved(false);
    const input: BrandInput = {};
    (Object.keys(draft) as (keyof Draft)[]).forEach((k) => {
      const v = draft[k].trim();
      if (v !== original[k]) input[k] = v;
    });
    if (Object.keys(input).length === 0) {
      setSaved(true);
      return;
    }
    mutation.mutate(input);
  };

  return (
    <>
      <PageHeader title="Marca">
        O sistema dos seus clientes, o app e este painel aparecem com o seu nome, as suas cores e os
        seus logos, no seu endereço. A marca vale quando tem endereço e nome do produto.
      </PageHeader>

      <p
        className={
          brand.active
            ? "mb-6 flex items-center gap-2 text-sm text-emerald-700"
            : "mb-6 flex items-center gap-2 text-sm text-amber-700"
        }
        role="status"
      >
        {brand.active ? (
          <CheckCircle2 className="size-4" aria-hidden="true" />
        ) : (
          <TriangleAlert className="size-4" aria-hidden="true" />
        )}
        {brand.active
          ? "Marca ativa: os seus clientes já veem o sistema com ela."
          : "Marca ainda não ativa: falta o endereço ou o nome do produto."}
      </p>

      <form onSubmit={submit} className="space-y-6">
        <section className="surface space-y-4 p-5" aria-labelledby="endereco-titulo">
          <h2 id="endereco-titulo" className="text-base font-semibold">
            Endereço
          </h2>
          <Field
            label="Endereço curto"
            value={draft.slug}
            onChange={onText("slug")}
            disabled={!editable}
            autoCapitalize="none"
            placeholder="ex.: lojafacil"
          />
          <p className="text-xs text-muted-foreground">
            De 3 a 30 letras minúsculas, números ou hífen. Não pode terminar em "-m" nem em
            "-suporte".
          </p>
          {brand.addresses && (
            <ul className="space-y-1 text-sm">
              <li>
                Sistema dos clientes: <strong>{brand.addresses.painel}</strong>
              </li>
              <li>
                App no celular: <strong>{brand.addresses.mobile}</strong>
              </li>
              <li>
                Este painel: <strong>{brand.addresses.suporte}</strong>
              </li>
            </ul>
          )}
          {slugChanged && (
            <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Trocar o endereço muda o endereço de todos os seus clientes. Quem usa o endereço
              antigo precisa entrar de novo pelo novo, e o app instalado no celular precisa ser
              instalado de novo.
            </p>
          )}
        </section>

        <section className="surface space-y-4 p-5" aria-labelledby="nome-titulo">
          <h2 id="nome-titulo" className="text-base font-semibold">
            Nome e cores
          </h2>
          <Field
            label="Nome do produto"
            value={draft.product_name}
            onChange={onText("product_name")}
            disabled={!editable}
            maxLength={40}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <ColorField
              label="Cor principal"
              value={draft.color_primary}
              onChange={set("color_primary")}
              disabled={!editable}
            />
            <ColorField
              label="Cor principal no fundo escuro"
              value={draft.color_primary_dark}
              onChange={set("color_primary_dark")}
              disabled={!editable}
            />
          </div>
        </section>

        <section className="surface space-y-4 p-5" aria-labelledby="contato-titulo">
          <h2 id="contato-titulo" className="text-base font-semibold">
            Contato e links
          </h2>
          <p className="text-xs text-muted-foreground">
            Aparecem para os seus clientes: nos e-mails (a resposta vai para o e-mail de suporte) e
            nas telas de ajuda.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="E-mail de suporte"
              type="email"
              value={draft.support_email}
              onChange={onText("support_email")}
              disabled={!editable}
            />
            <Field
              label="Telefone de suporte"
              value={draft.support_phone}
              onChange={onText("support_phone")}
              disabled={!editable}
            />
            <Field
              label="Site de suporte"
              value={draft.support_url}
              onChange={onText("support_url")}
              disabled={!editable}
              placeholder="https://"
            />
            <Field
              label="Termos de uso"
              value={draft.terms_url}
              onChange={onText("terms_url")}
              disabled={!editable}
              placeholder="https://"
            />
            <Field
              label="Política de privacidade"
              value={draft.privacy_url}
              onChange={onText("privacy_url")}
              disabled={!editable}
              placeholder="https://"
            />
          </div>
        </section>

        {mutation.isError && <ErrorText>{mutation.error.message}</ErrorText>}
        {saved && (
          <p className="flex items-center gap-2 text-sm text-emerald-700" role="status">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Marca salva.
          </p>
        )}
        {editable ? (
          <Button type="submit" loading={mutation.isPending}>
            Salvar marca
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Só o dono ou um administrador muda a marca.
          </p>
        )}
      </form>

      <section className="surface mt-6 space-y-4 p-5" aria-labelledby="imagens-titulo">
        <h2 id="imagens-titulo" className="text-base font-semibold">
          Imagens
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {ASSETS.map((a) => (
            <AssetSlot key={a.kind} brand={brand} {...a} />
          ))}
        </div>
      </section>

      <DomainSection brand={brand} />
    </>
  );
}
