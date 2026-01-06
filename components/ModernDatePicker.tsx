
import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Check, Infinity } from 'lucide-react';

interface DateRange {
    start: Date | null;
    end: Date | null;
}

interface ModernDatePickerProps {
    startDate: Date;
    endDate?: Date;
    onChange: (range: { start: Date, end: Date, label?: string }) => void;
    label?: string;
    isSingle?: boolean;
}

export const ModernDatePicker: React.FC<ModernDatePickerProps> = ({ startDate, endDate, onChange, label, isSingle = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date(startDate || new Date()));
    const [hoverDate, setHoverDate] = useState<Date | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const presets = [
        { label: 'Hoje', days: 0 },
        { label: 'Ontem', days: -1 },
        { label: 'Últimos 7 dias', days: 7 },
        { label: 'Últimos 30 dias', days: 30 },
        { label: 'Este Mês', type: 'month' },
        { label: 'Todo o Período', type: 'all' }
    ];

    const handlePreset = (preset: any) => {
        const end = new Date();
        const start = new Date();

        if (preset.type === 'all') {
            const allStart = new Date('2023-01-01');
            onChange({ start: allStart, end: end, label: preset.label });
        } else if (preset.type === 'month') {
            start.setDate(1);
            onChange({ start, end, label: preset.label });
        } else if (preset.days === -1) {
            start.setDate(start.getDate() - 1);
            end.setDate(end.getDate() - 1);
            onChange({ start, end, label: preset.label });
        } else if (preset.days === 0) {
            onChange({ start, end, label: preset.label });
        } else {
            start.setDate(end.getDate() - preset.days);
            onChange({ start, end, label: preset.label });
        }
        setIsOpen(false);
    };

    const handleDateClick = (day: number) => {
        const clickedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        
        if (isSingle) {
            onChange({ start: clickedDate, end: clickedDate, label: 'Data Específica' });
            setIsOpen(false);
            return;
        }

        // Logic for Range Selection
        if (startDate && !endDate && clickedDate >= startDate) {
            onChange({ start: startDate, end: clickedDate, label: 'Personalizado' });
            setIsOpen(false);
        } else {
            // Start new range (temporarily set end as start until second click)
            onChange({ start: clickedDate, end: clickedDate, label: 'Selecionando...' });
        }
    };

    const nextMonth = () => {
        const next = new Date(currentMonth);
        next.setMonth(next.getMonth() + 1);
        setCurrentMonth(next);
    };

    const prevMonth = () => {
        const prev = new Date(currentMonth);
        prev.setMonth(prev.getMonth() - 1);
        setCurrentMonth(prev);
    };

    // Calendar Generation
    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const firstDayOfWeek = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay(); // 0 = Sun
    
    const renderCalendarDays = () => {
        const days = [];
        // Empty slots for previous month
        for (let i = 0; i < firstDayOfWeek; i++) {
            days.push(<div key={`empty-${i}`} className="h-8 w-8"></div>);
        }
        
        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d);
            dateObj.setHours(0,0,0,0);
            
            const startStr = startDate?.toDateString();
            const endStr = endDate?.toDateString();
            const currStr = dateObj.toDateString();

            const isSelectedStart = startStr === currStr;
            const isSelectedEnd = endStr === currStr;
            const isInRange = startDate && endDate && dateObj > startDate && dateObj < endDate;
            
            // Hover logic for range preview
            const isHoverRange = !endDate && startDate && hoverDate && dateObj > startDate && dateObj <= hoverDate;

            days.push(
                <button
                    key={d}
                    onMouseEnter={() => setHoverDate(dateObj)}
                    onClick={() => handleDateClick(d)}
                    className={`
                        h-8 w-8 rounded-full text-xs font-bold transition-all relative z-10
                        ${isSelectedStart || isSelectedEnd ? 'bg-indigo-600 text-white shadow-md scale-110' : 'text-gray-700 hover:bg-indigo-100'}
                        ${isInRange ? 'bg-indigo-100 text-indigo-700 rounded-none' : ''}
                        ${isHoverRange ? 'bg-indigo-50 text-indigo-600' : ''}
                    `}
                >
                    {d}
                </button>
            );
        }
        return days;
    };

    const formatDateDisplay = () => {
        if (!startDate) return 'Selecione';
        const start = startDate.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'});
        if (isSingle) return start;
        const end = endDate ? endDate.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'}) : '...';
        return `${start} - ${end}`;
    };

    return (
        <div className="relative" ref={containerRef}>
            {/* Trigger Button */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    flex items-center gap-2 px-3 py-2 bg-white border rounded-lg shadow-sm hover:border-indigo-400 transition-all text-sm group
                    ${isOpen ? 'ring-2 ring-indigo-100 border-indigo-500' : 'border-gray-200'}
                `}
            >
                <div className={`p-1 rounded ${label === 'Todo o Período' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500 group-hover:text-indigo-600 group-hover:bg-indigo-50'}`}>
                    {label === 'Todo o Período' ? <Infinity size={14}/> : <CalendarIcon size={14}/>}
                </div>
                <div className="text-left flex flex-col leading-none">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{label || 'Período'}</span>
                    <span className="font-bold text-gray-700 text-xs mt-0.5">{label === 'Todo o Período' ? 'Histórico Completo' : formatDateDisplay()}</span>
                </div>
                <ChevronRight size={14} className={`text-gray-400 ml-2 transition-transform ${isOpen ? 'rotate-90' : ''}`}/>
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 p-0 z-50 flex overflow-hidden animate-fade-in-down origin-top-left w-[380px] md:w-auto flex-col md:flex-row">
                    
                    {/* Sidebar Presets */}
                    {!isSingle && (
                        <div className="bg-gray-50 p-2 border-r border-gray-100 w-full md:w-40 flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase px-2 mb-1 mt-2">Filtros Rápidos</span>
                            {presets.map((p, idx) => (
                                <button 
                                    key={idx}
                                    onClick={() => handlePreset(p)}
                                    className={`
                                        text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2
                                        ${label === p.label ? 'bg-indigo-100 text-indigo-700 font-bold' : 'text-gray-600 hover:bg-white hover:shadow-sm'}
                                    `}
                                >
                                    {p.label === 'Todo o Período' && <Infinity size={12}/>}
                                    {p.label}
                                    {label === p.label && <Check size={12} className="ml-auto"/>}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Calendar Area */}
                    <div className="p-4 w-72">
                        <div className="flex justify-between items-center mb-4">
                            <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded-full"><ChevronLeft size={16}/></button>
                            <span className="font-bold text-sm text-gray-800 capitalize">
                                {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                            </span>
                            <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded-full"><ChevronRight size={16}/></button>
                        </div>
                        
                        <div className="grid grid-cols-7 gap-1 text-center mb-2">
                            {['D','S','T','Q','Q','S','S'].map(d => (
                                <span key={d} className="text-[10px] font-bold text-gray-400">{d}</span>
                            ))}
                        </div>
                        
                        <div className="grid grid-cols-7 gap-1">
                            {renderCalendarDays()}
                        </div>

                        {!isSingle && (
                            <div className="mt-4 pt-3 border-t text-xs text-center text-gray-400">
                                {endDate ? 'Período selecionado' : 'Selecione a data final'}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
