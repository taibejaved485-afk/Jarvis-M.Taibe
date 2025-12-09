import React, { useEffect, useRef } from 'react';
import { SystemStatus } from '../types';

interface ArcReactorProps {
  active: boolean;
  volume: number; // 0 to 1
  themeColor: string;
  systemStatus: SystemStatus;
}

const ArcReactor: React.FC<ArcReactorProps> = ({ active, volume, themeColor, systemStatus }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Use refs to hold latest prop values for the animation loop
  // This prevents the useEffect from restarting (and resetting particles) on every prop change
  const statusRef = useRef(systemStatus);
  const volumeRef = useRef(volume);
  const themeRef = useRef(themeColor);
  const activeRef = useRef(active);

  useEffect(() => { statusRef.current = systemStatus; }, [systemStatus]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { themeRef.current = themeColor; }, [themeColor]);
  useEffect(() => { activeRef.current = active; }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let rotation = 0;
    let memoryRotation = 0;
    
    // Initialize particles once
    const particles = Array.from({ length: 12 }, (_, i) => ({
      angle: (i * Math.PI * 2) / 12,
      speed: 0.01 + Math.random() * 0.02,
      distance: 60 + Math.random() * 40,
      size: 1 + Math.random() * 2,
      offset: Math.random() * 100
    }));

    const draw = () => {
      if (!canvas || !ctx) return;
      
      const currentStatus = statusRef.current;
      const currentVol = volumeRef.current;
      const currentTheme = themeRef.current;
      const isActive = activeRef.current;
      
      // Calculate load factor (0 to 1) for dynamic speed
      const cpuFactor = Math.max(0, Math.min(1, currentStatus.cpu / 100));

      const getColor = (alpha: number) => {
        if (currentTheme === 'red') return `rgba(239, 68, 68, ${alpha})`;
        if (currentTheme === 'gold') return `rgba(234, 179, 8, ${alpha})`;
        return `rgba(6, 182, 212, ${alpha})`; // cyan default
      };

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      // Integrity Jitter Calculation
      // 100% integrity = 0 jitter. 
      const integrityFactor = Math.max(0, currentStatus.integrity) / 100;
      const jitterAmount = (1 - integrityFactor) * 8; // Max 8px jitter
      const jitterX = (Math.random() - 0.5) * jitterAmount;
      const jitterY = (Math.random() - 0.5) * jitterAmount;

      const baseRadius = 65;
      // Dynamic pulsing based on volume and activity
      const pulse = isActive ? 1 + (currentVol * 0.3) : 1 + Math.sin(Date.now() / 2000) * 0.03;
      const radius = baseRadius * pulse;

      // --- CRITICAL INTEGRITY WARNING (Expanding Rings) ---
      if (currentStatus.integrity < 80) {
        // Create 2 staggered rings emitting from center
        [0, 1000].forEach(delay => {
           const duration = 2000;
           const t = ((Date.now() + delay) % duration) / duration; // 0 -> 1
           
           // Ease out for expanding effect
           const ease = 1 - Math.pow(1 - t, 3); 
           const ringRadius = radius + (ease * 150); // Expand outward
           const alpha = (1 - t) * 0.6; // Fade out

           ctx.save();
           ctx.translate(centerX, centerY);
           ctx.beginPath();
           ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
           ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`; // Always Red for danger
           ctx.lineWidth = 2;
           ctx.stroke();
           ctx.restore();
        });
      }

      // --- LAYER 1: Core (Affected by Jitter) ---
      ctx.save();
      ctx.translate(centerX + jitterX, centerY + jitterY);

      // Gradient Glow
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      gradient.addColorStop(0, getColor(0.9 * integrityFactor));
      gradient.addColorStop(0.4, getColor(0.3 * integrityFactor));
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();

      // Solid Center
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = getColor(isActive ? 0.4 : 0.1);
      ctx.fill();
      
      // Integrity Ring (Inner Status)
      // Visualizes system health. Complete circle = 100%.
      ctx.beginPath();
      ctx.strokeStyle = getColor(0.9);
      ctx.lineWidth = 3;
      const integrityEndAngle = (Math.PI * 2) * integrityFactor;
      ctx.arc(0, 0, radius * 0.55, -Math.PI/2, -Math.PI/2 + integrityEndAngle);
      ctx.stroke();

      // Broken segment if damaged
      if (integrityFactor < 1) {
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(255, 50, 50, 0.8)'; // Red alert
          ctx.lineWidth = 2;
          ctx.arc(0, 0, radius * 0.55, -Math.PI/2 + integrityEndAngle + 0.1, -Math.PI/2 + (Math.PI*2));
          ctx.stroke();
          
          // Add "Warning" text in center if critical
          if (integrityFactor < 0.6) {
             ctx.fillStyle = 'rgba(255,50,50,0.8)';
             ctx.font = '10px Rajdhani';
             ctx.textAlign = 'center';
             ctx.fillText('WARNING', 0, 4);
          }
      }
      ctx.restore(); // End Jitter

      // --- LAYER 2: CPU Load (Segmented Ring) ---
      const cpuRadius = radius + 25;
      const cpuSegments = 40;
      const activeCpuSegments = Math.max(1, Math.floor((currentStatus.cpu / 100) * cpuSegments));
      const isHighLoad = currentStatus.cpu > 80;

      // Calculate pulsing variables for high load
      let cpuAlpha = 0.8;
      let cpuShadowBlur = 8;
      let cpuShadowAlpha = 0.6;
      
      if (isHighLoad) {
          const pulseSpeed = Date.now() / 150;
          const pulseVal = (Math.sin(pulseSpeed) + 1) / 2; // 0 to 1
          cpuAlpha = 0.7 + (pulseVal * 0.3); // 0.7 - 1.0
          cpuShadowBlur = 8 + (pulseVal * 12); // 8 - 20
          cpuShadowAlpha = 0.6 + (pulseVal * 0.4); // 0.6 - 1.0
      }

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(-rotation * 0.5); 
      
      for (let i = 0; i < cpuSegments; i++) {
        const angle = (i / cpuSegments) * Math.PI * 2;
        const segmentLength = (Math.PI * 2) / cpuSegments - 0.05;
        
        ctx.beginPath();
        if (i < activeCpuSegments) {
            ctx.strokeStyle = getColor(cpuAlpha);
            ctx.shadowBlur = cpuShadowBlur;
            ctx.shadowColor = getColor(cpuShadowAlpha);
            ctx.lineWidth = 4;
        } else {
            ctx.strokeStyle = getColor(0.05);
            ctx.shadowBlur = 0;
            ctx.lineWidth = 2;
        }
        ctx.arc(0, 0, cpuRadius, angle, angle + segmentLength);
        ctx.stroke();
      }
      ctx.restore();

      // --- LAYER 3: Structure Arcs ---
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation);
      for (let i = 0; i < 3; i++) {
        const startAngle = i * (Math.PI * 2 / 3);
        const arcLen = (Math.PI * 2 / 3) - 0.6;
        
        ctx.beginPath();
        ctx.arc(0, 0, radius + 15, startAngle, startAngle + arcLen);
        ctx.strokeStyle = getColor(0.5);
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Arc tips
        const tipX = Math.cos(startAngle + arcLen) * (radius + 15);
        const tipY = Math.sin(startAngle + arcLen) * (radius + 15);
        ctx.beginPath();
        ctx.arc(tipX, tipY, 2, 0, Math.PI*2);
        ctx.fillStyle = getColor(0.9);
        ctx.fill();
      }
      ctx.restore();

      // --- LAYER 4: Memory (Outer Ring) ---
      const memRadius = radius + 55;
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation * (0.5 + (currentStatus.memory / 40))); 
      
      ctx.beginPath();
      ctx.setLineDash([2, 8, 20, 8]);
      ctx.strokeStyle = getColor(0.3);
      ctx.lineWidth = 1;
      ctx.arc(0, 0, memRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Reading head (Dynamic speed)
      ctx.beginPath();
      ctx.arc(Math.cos(memoryRotation)*memRadius, Math.sin(memoryRotation)*memRadius, 3, 0, Math.PI*2);
      ctx.fillStyle = getColor(1);
      ctx.shadowBlur = 5;
      ctx.shadowColor = getColor(1);
      ctx.fill();
      ctx.restore();

      // --- LAYER 5: Network Activity ---
      if (currentStatus.network === 'ONLINE') {
        // Pulse (Radar Sweep)
        const pulseLoop = (Date.now() % 2000) / 2000;
        const pulseRadius = memRadius + (pulseLoop * 50);
        
        ctx.beginPath();
        ctx.strokeStyle = getColor((1 - pulseLoop) * 0.4);
        ctx.lineWidth = 1;
        ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Data Particles
        ctx.save();
        ctx.translate(centerX, centerY);
        particles.forEach((p, i) => {
           // Move - Speed affected by CPU Load
           p.angle += p.speed * (isActive ? 2 : 1) * (1 + cpuFactor * 1.5);
           const r = p.distance + Math.sin(Date.now()/500 + i + p.offset)*5;
           
           const x = Math.cos(p.angle) * r;
           const y = Math.sin(p.angle) * r;

           // Trace
           ctx.beginPath();
           ctx.strokeStyle = getColor(0.1);
           ctx.arc(0, 0, r, p.angle - 0.4, p.angle);
           ctx.stroke();

           // Dot
           ctx.beginPath();
           ctx.fillStyle = getColor(0.8);
           ctx.arc(x, y, p.size, 0, Math.PI * 2);
           ctx.fill();
        });
        ctx.restore();
      } else {
          // Offline "X" or broken signal
          ctx.save();
          ctx.translate(centerX, centerY);
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(255, 50, 50, 0.6)';
          ctx.lineWidth = 2;
          ctx.moveTo(memRadius, 0);
          ctx.lineTo(memRadius + 10, 0); // Static blip
          ctx.stroke();
          
          // Flashing Offline Text
          if (Math.floor(Date.now() / 500) % 2 === 0) {
              ctx.font = '12px Orbitron';
              ctx.fillStyle = 'rgba(255, 50, 50, 0.8)';
              ctx.textAlign = 'center';
              ctx.fillText('OFFLINE', 0, memRadius + 30);
          }
          ctx.restore();
      }

      // Dynamic rotation speed based on CPU load and Activity
      rotation += (isActive ? 0.015 : 0.003) + (currentVol * 0.03) + (cpuFactor * 0.04);
      
      // Dynamic memory head speed
      memoryRotation += 0.02 + (cpuFactor * 0.05);
      
      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(animationId);
  }, []); // Run setup once, loops via refs
  
  const getCrosshairColor = () => {
      if (themeColor === 'red') return 'bg-red-500';
      if (themeColor === 'gold') return 'bg-yellow-500';
      return 'bg-cyan-500';
  }

  return (
    <div className="relative flex items-center justify-center">
        <canvas 
            ref={canvasRef} 
            width={420} 
            height={420} 
            className="z-10"
        />
        {/* Background crosshairs - Explicit classes */}
        <div className={`absolute w-[600px] h-[1px] ${getCrosshairColor()} opacity-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2`}></div>
        <div className={`absolute h-[600px] w-[1px] ${getCrosshairColor()} opacity-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2`}></div>
    </div>
  );
};

export default ArcReactor;