import React, { useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';

const MatrixRain: React.FC = () => {
    const { theme } = useTheme();
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (theme !== 'matrix') return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = (canvas.width = window.innerWidth);
        let height = (canvas.height = window.innerHeight);

        const columns = Math.floor(width / 20);
        const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$+-*/=%\"'#&_(),.;:?!\\|{}<>[]^~";
        const charArray = characters.split("");
        const drops: number[] = [];

        for (let i = 0; i < columns; i++) {
            drops[i] = 1;
        }

        let frameId: number;

        const draw = () => {
            ctx.fillStyle = "rgba(13, 2, 8, 0.1)";
            ctx.fillRect(0, 0, width, height);

            ctx.fillStyle = "#00FF41";
            ctx.font = "15px monospace";

            for (let i = 0; i < drops.length; i++) {
                const text = charArray[Math.floor(Math.random() * charArray.length)];
                ctx.fillText(text, i * 20, drops[i] * 20);

                if (drops[i] * 20 > height && Math.random() > 0.975) {
                    drops[i] = 0;
                }

                drops[i]++;
            }
            frameId = window.requestAnimationFrame(draw);
        };

        const handleResize = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
            const newColumns = Math.floor(width / 20);
            while (drops.length < newColumns) drops.push(1);
        };

        window.addEventListener('resize', handleResize);
        draw();

        return () => {
            window.removeEventListener('resize', handleResize);
            window.cancelAnimationFrame(frameId);
        };
    }, [theme]);

    if (theme !== 'matrix') return null;

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 z-[-1] pointer-events-none opacity-20"
            style={{ filter: 'blur(0.5px)' }}
        />
    );
};

export default MatrixRain;
