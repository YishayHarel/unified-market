import SocialFeatures from "@/components/SocialFeatures";

const Social = () => {
  return (
    <div className="min-h-screen bg-background text-foreground p-6 pb-24 space-y-6">
      <header className="text-center">
        <h1 className="text-3xl font-bold">👥 Social Trading</h1>
        <p className="text-muted-foreground mt-2">Connect with traders and share your picks</p>
      </header>
      
      <SocialFeatures />
    </div>
  );
};

export default Social;