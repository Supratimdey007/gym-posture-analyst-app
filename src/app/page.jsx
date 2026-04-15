// src/app/page.jsx
import React from "react";
import PostureTracker from "@/components/PoseTracker";   
import { Dumbbell } from "lucide-react";

export default function PoseTracker() {
  console.log("PostureTracker imported:", PostureTracker); 

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center">
            <Dumbbell className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Gym Posture Tracker</h1>
            <p className="text-xs text-zinc-500">AI-powered exercise form analysis</p>
          </div>
        </div>
      </header>

      <main className="py-8">
        <PostureTracker />
      </main>

      <footer className="border-t border-zinc-800 py-6 mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-zinc-600">
          Using MediaPipe Pose Detection for real-time tracking
        </div>
      </footer>
    </div>
  );
}