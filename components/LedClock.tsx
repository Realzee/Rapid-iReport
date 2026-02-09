import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';

type Segment = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';
type Char = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | ' ' | 'c' | 'f' | 'd' | 'm';
type Size = 'large' | 'small';

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
    const sizeClass = size === 'large' ? 'seg-char-large' : 'seg-char-small';

    return (
        <div className={`segment-char ${sizeClass}`}>
            {segments.map(s => (
                <div key={s} className={`segment s-${s} ${activeSegments.includes(s) ? 'lit' : 'off'}`}></div>
            ))}
        </div>
    );
};

const Colon: React.FC<{ size: Size }> = ({ size }) => {
    const sizeClass = size === 'large' ? 'colon-large' : 'colon-small';
    return (
        <div className={`relative ${sizeClass}`} style={{ width: size === 'large' ? '10px' : '5px'}}>
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

    const hours = format(time, 'hh');
    const minutes = format(time, 'mm');
    const amPm = format(time, 'aa');
    const dayOfWeek = format(time, 'eee'); // Mon, Tue, etc.

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
        <div className="led-clock-container hidden md:flex items-center justify-between gap-4 font-mono">
            {/* Day of Week */}
            <div className="flex flex-col text-sm pr-2 border-r border-red-900/50">
                {days.map(day => (
                    <span key={day} className={`led-day ${day.toLowerCase() === dayOfWeek.toLowerCase() ? 'lit' : ''}`}>
                        {day}
                    </span>
                ))}
            </div>

            {/* Main Time */}
            <div className="flex items-center">
                <SevenSegmentChar char={hours[0] as Char} size="large" />
                <SevenSegmentChar char={hours[1] as Char} size="large" />
                <Colon size="large" />
                <SevenSegmentChar char={minutes[0] as Char} size="large" />
                <SevenSegmentChar char={minutes[1] as Char} size="large" />
            </div>

            {/* AM/PM and Secondary Info */}
            <div className="flex flex-col items-start justify-between h-full pl-2 border-l border-red-900/50">
                <span className={`led-small-text text-sm ${amPm.toLowerCase() === 'am' ? 'opacity-100' : 'opacity-20'}`}>AM</span>
                <span className={`led-small-text text-sm ${amPm.toLowerCase() === 'pm' ? 'opacity-100' : 'opacity-20'}`}>PM</span>
            </div>
            
            <div className="flex flex-col items-center">
                {/* Temperature */}
                <div className="flex items-end">
                    <SevenSegmentChar char="1" size="small" />
                    <SevenSegmentChar char="3" size="small" />
                    <SevenSegmentChar char="8" size="small" />
                    <div className="flex flex-col ml-1 text-xs">
                        <span className="led-small-text">°F</span>
                        <span className="led-small-text opacity-30">°C</span>
                    </div>
                </div>
                 {/* Date */}
                <div className="flex items-end mt-1">
                    <SevenSegmentChar char="2" size="small" />
                    <SevenSegmentChar char="3" size="small" />
                    <SevenSegmentChar char="1" size="small" />
                    <SevenSegmentChar char="1" size="small" />
                    <div className="flex flex-col ml-1 text-xs">
                        <span className="led-small-text">D</span>
                        <span className="led-small-text opacity-30">M</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LedClock;
