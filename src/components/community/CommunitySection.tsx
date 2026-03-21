'use client';

import CommunityActivities from './CommunityActivities';
import CommunityCircle from './CommunityCircle';

export default function CommunitySection() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="space-y-20">
          <CommunityActivities />
        </div>
      </div>
    </section>
  );
}
