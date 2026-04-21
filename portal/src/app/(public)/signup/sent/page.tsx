export default function SignupSentPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="glass max-w-md p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Vérifiez votre boîte mail</h1>
        <p className="text-muted">
          Un lien de vérification vous a été envoyé. Cliquez dessus pour activer votre compte.
          Le lien expire dans 24 heures.
        </p>
      </div>
    </main>
  );
}
