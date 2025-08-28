import NewsSection from "@/components/NewsSection";

const News = () => {
  return (
    <div className="min-h-screen bg-background text-foreground p-6 pb-24 space-y-6">
      <header className="text-center">
        <h1 className="text-3xl font-bold">📰 Market News</h1>
        <p className="text-muted-foreground mt-2">Latest financial news and updates</p>
      </header>
      
      <NewsSection />
    </div>
  );
};

export default News;