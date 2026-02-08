"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, CameraOff, RotateCcw, Dumbbell, CheckCircle2, XCircle } from "lucide-react";

const POSE_CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [24, 26],
  [25, 27], [26, 28], [27, 29], [28, 30], [29, 31], [30, 32],
  [15, 17], [16, 18], [17, 19], [18, 20], [15, 21], [16, 22],
];

const VIDEO_WIDTH = 720;
const VIDEO_HEIGHT = 540;

const EXERCISES = {
  bicep_curl: {
    name: "Bicep Curl",
    downAngle: 160,
    upAngle: 45,
    joint: "elbow",
  },
  shoulder_press: {
    name: "Shoulder Press",
    downAngle: 90,
    upAngle: 170,
    joint: "shoulder",
  },
};

export default function PoseTracker() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const landmarkerRef = useRef(null);
  const rafRef = useRef(0);
  const streamRef = useRef(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState(null);
  const [selectedExercise, setSelectedExercise] = useState("bicep_curl");

  const [leftReps, setLeftReps] = useState(0);
  const [rightReps, setRightReps] = useState(0);
  const [leftArmAngle, setLeftArmAngle] = useState(null);
  const [rightArmAngle, setRightArmAngle] = useState(null);
  const [leftShoulderAngle, setLeftShoulderAngle] = useState(null);
  const [rightShoulderAngle, setRightShoulderAngle] = useState(null);
  const [leftPostureCorrect, setLeftPostureCorrect] = useState(false);
  const [rightPostureCorrect, setRightPostureCorrect] = useState(false);

  const leftStageRef = useRef("down");
  const rightStageRef = useRef("down");

  const resetReps = () => {
    setLeftReps(0);
    setRightReps(0);
    leftStageRef.current = "down";
    rightStageRef.current = "down";
  };

  const calculateAngle = (a, b, c) => {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180) / Math.PI);
    if (angle > 180) angle = 360 - angle;
    return Math.round(angle);
  };

  const processLandmarks = useCallback((landmarks, ctx, width, height) => {
    if (!landmarks || landmarks.length < 33) return;

    const getPoint = (idx) => ({
      x: landmarks[idx].x * width,
      y: landmarks[idx].y * height,
      visibility: landmarks[idx].visibility ?? 0,
    });

    const lShoulder = getPoint(11);
    const lElbow = getPoint(13);
    const lWrist = getPoint(15);
    const lHip = getPoint(23);

    const leftElbowAngle = calculateAngle(lShoulder, lElbow, lWrist);
    const leftShoulderAngleVal = calculateAngle(lElbow, lShoulder, lHip);

    const rShoulder = getPoint(12);
    const rElbow = getPoint(14);
    const rWrist = getPoint(16);
    const rHip = getPoint(24);

    const rightElbowAngle = calculateAngle(rShoulder, rElbow, rWrist);
    const rightShoulderAngleVal = calculateAngle(rElbow, rShoulder, rHip);

    setLeftArmAngle(leftElbowAngle);
    setRightArmAngle(rightElbowAngle);
    setLeftShoulderAngle(leftShoulderAngleVal);
    setRightShoulderAngle(rightShoulderAngleVal);

    const exercise = EXERCISES[selectedExercise];
    if (!exercise) return;

    const { downAngle, upAngle, joint } = exercise;
    const leftAngle = joint === "elbow" ? leftElbowAngle : leftShoulderAngleVal;
    const rightAngle = joint === "elbow" ? rightElbowAngle : rightShoulderAngleVal;

    const tolerance = 10;
    const isDown = (angle) => Math.abs(angle - downAngle) <= tolerance;
    const isUp = (angle) => joint === "shoulder"
      ? angle >= upAngle - tolerance
      : angle <= upAngle + tolerance;

    // Posture feedback: check if currently in correct down or up position
    setLeftPostureCorrect(isDown(leftAngle) || isUp(leftAngle));
    setRightPostureCorrect(isDown(rightAngle) || isUp(rightAngle));

    // Rep counting: down -> up = 1 rep
    if (isDown(leftAngle)) {
      leftStageRef.current = "down";
    }
    if (isUp(leftAngle) && leftStageRef.current === "down") {
      leftStageRef.current = "up";
      setLeftReps(prev => prev + 1);
    }

    if (isDown(rightAngle)) {
      rightStageRef.current = "down";
    }
    if (isUp(rightAngle) && rightStageRef.current === "down") {
      rightStageRef.current = "up";
      setRightReps(prev => prev + 1);
    }

    ctx.font = "16px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`${leftElbowAngle}°`, lElbow.x + 20, lElbow.y - 10);
    ctx.fillText(`${rightElbowAngle}°`, rElbow.x + 20, rElbow.y - 10);
  }, [selectedExercise]);

  const drawLandmarks = useCallback((ctx, landmarks) => {
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#00ff99";

    POSE_CONNECTIONS.forEach(([start, end]) => {
      const a = landmarks[start];
      const b = landmarks[end];
      if (a && b && a.visibility > 0.4 && b.visibility > 0.4) {
        ctx.beginPath();
        ctx.moveTo(a.x * VIDEO_WIDTH, a.y * VIDEO_HEIGHT);
        ctx.lineTo(b.x * VIDEO_WIDTH, b.y * VIDEO_HEIGHT);
        ctx.stroke();
      }
    });

    landmarks.forEach((lm, i) => {
      if (lm && lm.visibility > 0.5) {
        ctx.beginPath();
        ctx.arc(lm.x * VIDEO_WIDTH, lm.y * VIDEO_HEIGHT, 6, 0, 2 * Math.PI);
        ctx.fillStyle = [11,12,13,14,15,16,23,24].includes(i) ? "#ff3366" : "#00aaff";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  }, []);

  const detectLoop = useCallback(() => {
    if (
      !videoRef.current ||
      !canvasRef.current ||
      !landmarkerRef.current ||
      videoRef.current.readyState < 2
    ) {
      rafRef.current = requestAnimationFrame(detectLoop);
      return;
    }

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) {
      rafRef.current = requestAnimationFrame(detectLoop);
      return;
    }

    const results = landmarkerRef.current.detectForVideo(
      videoRef.current,
      performance.now()
    );

    ctx.save();
    ctx.clearRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);

    ctx.translate(VIDEO_WIDTH, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoRef.current, 0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (results.landmarks?.length > 0) {
      const landmarks = results.landmarks[0];
      const mirroredLandmarks = landmarks.map((lm) => ({
        ...lm,
        x: 1 - lm.x,
      }));

      drawLandmarks(ctx, mirroredLandmarks);
      processLandmarks(mirroredLandmarks, ctx, VIDEO_WIDTH, VIDEO_HEIGHT);
    }

    ctx.restore();
    rafRef.current = requestAnimationFrame(detectLoop);
  }, [drawLandmarks, processLandmarks]);

  const initLandmarker = useCallback(async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
      );

      landmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      });

      setIsLoading(false);
    } catch (err) {
      console.error("Failed to initialize PoseLandmarker:", err);
      setError("Failed to load pose detection model. Please refresh.");
      setIsLoading(false);
    }
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT, facingMode: "user" },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(console.error);
          setIsRunning(true);
          detectLoop();
        };
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setError("Camera access denied. Please allow camera permissions.");
    }
  }, [detectLoop]);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsRunning(false);

    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
  }, []);

  useEffect(() => {
    initLandmarker();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      landmarkerRef.current?.close();
    };
  }, [initLandmarker]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full max-w-7xl mx-auto p-4">
      <div className="flex-1">
        <div
          className="relative rounded-2xl overflow-hidden bg-zinc-900 shadow-2xl"
          style={{ width: VIDEO_WIDTH, height: VIDEO_HEIGHT }}
        >
          <video
            ref={videoRef}
            className="absolute top-0 left-0 w-full h-full object-cover opacity-0"
            autoPlay
            muted
            playsInline
          />
          <canvas
            ref={canvasRef}
            width={VIDEO_WIDTH}
            height={VIDEO_HEIGHT}
            className="absolute top-0 left-0 w-full h-full"
          />

          {!isRunning && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 backdrop-blur-sm">
              {isLoading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-zinc-400 text-sm">Loading AI Model...</span>
                </div>
              ) : error ? (
                <div className="text-red-400 text-center px-4">{error}</div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <Camera className="w-16 h-16 text-zinc-600" />
                  <span className="text-zinc-400">Click Start to begin tracking</span>
                </div>
              )}
            </div>
          )}

          {isRunning && (
            <>
              <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm rounded-xl px-4 py-3">
                <div className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Left Arm</div>
                <div className="text-3xl font-bold text-emerald-400">{leftReps}</div>
                <div className="text-xs text-zinc-500 capitalize">{leftStageRef.current}</div>
              </div>

              <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-sm rounded-xl px-4 py-3 text-right">
                <div className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Right Arm</div>
                <div className="text-3xl font-bold text-emerald-400">{rightReps}</div>
                <div className="text-xs text-zinc-500 capitalize">{rightStageRef.current}</div>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3 mt-4 justify-center flex-wrap">
          {!isRunning ? (
            <Button
              onClick={startCamera}
              disabled={isLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8"
              size="lg"
            >
              <Camera className="w-5 h-5 mr-2" />
              Start Camera
            </Button>
          ) : (
            <Button
              onClick={stopCamera}
              variant="destructive"
              className="px-8"
              size="lg"
            >
              <CameraOff className="w-5 h-5 mr-2" />
              Stop Camera
            </Button>
          )}
          <Button onClick={resetReps} variant="outline" size="lg">
            <RotateCcw className="w-5 h-5 mr-2" />
            Reset Reps
          </Button>
        </div>
      </div>

        <div className="w-full lg:w-80 space-y-4">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Dumbbell className="w-5 h-5 text-emerald-500" />
                <h3 className="text-lg font-semibold text-white">Exercise</h3>
              </div>
              
                <Button
                  onClick={() => { setSelectedExercise("bicep_curl"); resetReps(); }}
                  variant={selectedExercise === "bicep_curl" ? "default" : "outline"}
                  className={`w-full ${
                    selectedExercise === "bicep_curl"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : ""
                  }`}
                  size="lg"
                >
                  <Dumbbell className="w-5 h-5 mr-2" />
                  Bicep Curl
                </Button>

                <Button
                  onClick={() => { setSelectedExercise("shoulder_press"); resetReps(); }}
                  variant={selectedExercise === "shoulder_press" ? "default" : "outline"}
                  className={`w-full mt-2 ${
                    selectedExercise === "shoulder_press"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : ""
                  }`}
                  size="lg"
                >
                  <Dumbbell className="w-5 h-5 mr-2" />
                  Shoulder Press
                </Button>
                
                <p className="text-xs text-zinc-500 mt-3">
                  {selectedExercise === "bicep_curl"
                    ? "Down: elbow ~160° | Up: elbow ~45° = 1 rep"
                    : "Down: shoulder ~90° | Up: shoulder ~170° = 1 rep"}
                </p>
            </CardContent>
          </Card>

          {isRunning && (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Posture Check</h3>
                
                <div className="space-y-3">
                  <div className={`flex items-center justify-between p-3 rounded-lg ${
                    leftPostureCorrect ? "bg-emerald-900/30 border border-emerald-700" : "bg-red-900/30 border border-red-700"
                  }`}>
                    <span className="text-sm text-zinc-300">Left Arm</span>
                    <div className="flex items-center gap-2">
                      {leftPostureCorrect ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          <span className="text-emerald-400 text-sm font-medium">Correct</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-5 h-5 text-red-400" />
                          <span className="text-red-400 text-sm font-medium">Adjust</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className={`flex items-center justify-between p-3 rounded-lg ${
                    rightPostureCorrect ? "bg-emerald-900/30 border border-emerald-700" : "bg-red-900/30 border border-red-700"
                  }`}>
                    <span className="text-sm text-zinc-300">Right Arm</span>
                    <div className="flex items-center gap-2">
                      {rightPostureCorrect ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          <span className="text-emerald-400 text-sm font-medium">Correct</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-5 h-5 text-red-400" />
                          <span className="text-red-400 text-sm font-medium">Adjust</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                <p className="text-xs text-zinc-500 mt-4">
                    {selectedExercise === "bicep_curl"
                      ? "Extend arms fully (~160°) then curl up (~45°) for a rep"
                      : "Start at ~90° shoulder angle, press up to ~170° for a rep"}
                  </p>
              </CardContent>
            </Card>
          )}

          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-5">
                <Dumbbell className="w-5 h-5 text-emerald-500" />
                <h3 className="text-lg font-semibold text-white">Joint Angles</h3>
              </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-2 gap-4">
              <div className="bg-zinc-800/80 rounded-lg p-4 border border-zinc-700 text-center">
                <div className="text-sm text-zinc-400 mb-1">Left Elbow</div>
                <div className="text-3xl font-bold text-emerald-400">
                  {leftArmAngle !== null ? `${leftArmAngle}°` : "—"}
                </div>
              </div>

              <div className="bg-zinc-800/80 rounded-lg p-4 border border-zinc-700 text-center">
                <div className="text-sm text-zinc-400 mb-1">Right Elbow</div>
                <div className="text-3xl font-bold text-emerald-400">
                  {rightArmAngle !== null ? `${rightArmAngle}°` : "—"}
                </div>
              </div>

              <div className="bg-zinc-800/80 rounded-lg p-4 border border-zinc-700 text-center">
                <div className="text-sm text-zinc-400 mb-1">Left Shoulder</div>
                <div className="text-3xl font-bold text-amber-400">
                  {leftShoulderAngle !== null ? `${leftShoulderAngle}°` : "—"}
                </div>
              </div>

              <div className="bg-zinc-800/80 rounded-lg p-4 border border-zinc-700 text-center">
                <div className="text-sm text-zinc-400 mb-1">Right Shoulder</div>
                <div className="text-3xl font-bold text-amber-400">
                  {rightShoulderAngle !== null ? `${rightShoulderAngle}°` : "—"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-white mb-3">How to Use</h3>
            <ul className="text-sm text-zinc-400 space-y-2">
              <li>• Position yourself so your full arms and torso are visible</li>
              <li>• Perform bicep curls with controlled movement</li>
              <li>• Green lines = arm angle (shoulder–elbow–wrist)</li>
              <li>• Pink/red points = key tracked joints</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}