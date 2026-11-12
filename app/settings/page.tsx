import SettingsForm from "./SettingsForm";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <div className="stack">
      <div>
        <h2 style={{ margin: 0 }}>Configurações</h2>
        <p className="muted" style={{ margin: "4px 0 0" }}>
          Valem para os próximos vídeos (o worker relê antes de cada projeto). Chaves de API ficam só no arquivo <code>.env</code>.
        </p>
      </div>
      <SettingsForm />
    </div>
  );
}
