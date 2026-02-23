import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';

type Segment = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';
type Char = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | ' ' | 'c' | 'f' | 'd' | 'm';
type Size = 'compact';

const segmentMap: Record<Char, Segment[]> = {
    '0': ['a', 'b', 'c', 'd', 'e', 'f'],
    '1': ['b', 'c'],
    '2': ['a', 'b', 'g', 'e', 'd'],
    '3': ['a', 'b', 'g', 'c', 'd'],
    '4': ['f', 'g', 'b', 'c'],
    '5': ['a', 'f', 'g', 'c', 'd'],
    '6': ['a', 'f', 'g', 'e', 'c', 'd'],
    '7': ['a', 'b', 'c'],
    '8': ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    '9': ['a', 'b', 'c', 'd', 'f', 'g'],
    'c': ['a', 'f', 'e', 'd'],
    'f': ['a', 'f', 'e', 'g'],
    'd': ['b', 'c', 'd', 'e', 'g'],
    'm': [], // Custom rendered as text
    ' ': [],
};

const SevenSegmentChar: React.FC<{ char: Char; size: Size }> = ({ char, size }) => {
    const activeSegments = segmentMap[char] || [];
    const segments: Segment[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const sizeClass = 'seg-char-compact';

    return (
        <div className={`segment-char ${sizeClass}`}>
            {segments.map(s => (
                <div key={s} className={`segment s-${s} ${activeSegments.includes(s) ? 'lit' : 'off'}`}></div>
            ))}
        </div>
    );
};

const Colon: React.FC<{ size: Size }> = ({ size }) => {
    const sizeClass = 'colon-compact';
    return (
        <div className={`relative ${sizeClass}`} style={{ width: '9px'}}>
            <div className="segment lit dot dot-top absolute"></div>
            <div className="segment lit dot dot-bottom absolute"></div>
        </div>
    );
};

const LedClock: React.FC = () => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const hours = format(time, 'HH');
    const minutes = format(time, 'mm');
    const dayOfWeek = format(time, 'eee'); // Mon, Tue, etc.
    const dateStr = format(time, 'dd MMM');

    return (
        <div className="led-clock-container hidden md:flex items-center justify-between gap-2 font-mono">
            {/* Day of Week & Date */}
            <div className="flex flex-col pr-1 border-r border-gray-300 dark:border-red-900/50 justify-center">
                <span className="led-day lit text-center">{dayOfWeek.toUpperCase()}</span>
                <span className="led-small-text text-center">{dateStr.toUpperCase()}</span>
            </div>

            {/* Main Time */}
            <div className="flex items-center gap-1">
                <SevenSegmentChar char={hours[0] as Char} size="compact" />
                <SevenSegmentChar char={hours[1] as Char} size="compact" />
                <Colon size="compact" />
                <SevenSegmentChar char={minutes[0] as Char} size="compact" />
                <SevenSegmentChar char={minutes[1] as Char} size="compact" />
            </div>
        </div>
    );
};

export default LedClock;