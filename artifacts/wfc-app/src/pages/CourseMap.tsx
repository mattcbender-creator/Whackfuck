import React, { Suspense } from 'react';

const LeafletMap = React.lazy(() => import('../components/LeafletMap'));

export default function CourseMap() {
  return (
    <div className="h-[100dvh] w-full bg-background flex flex-col pb-16">
      <div className="p-4 bg-background/95 backdrop-blur border-b border-border z-10 shrink-0">
        <h2 className="font-condensed text-2xl font-bold uppercase tracking-wider text-foreground neon-text">
          Course GPS
        </h2>
        <p className="text-xs text-muted-foreground mt-1">Dundee Country Club</p>
      </div>
      
      <div className="flex-1 relative">
        <Suspense fallback={
          <div className="absolute inset-0 flex items-center justify-center bg-card">
            <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Loading Map Data...</p>
            </div>
          </div>
        }>
          <LeafletMap />
        </Suspense>
      </div>
    </div>
  );
}