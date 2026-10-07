import { useRef, type ButtonHTMLAttributes, type MouseEvent, type TouchEvent } from 'react';

type AccordionHeaderButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'type'> & {
  onToggle: () => void;
};

/**
 * iOS delivers a touchend and a later click for one tap, and it drops the click
 * when a focused field blurs or the panel height changes. Toggle once per tap.
 */
export default function AccordionHeaderButton({ onToggle, ...props }: AccordionHeaderButtonProps) {
  const onToggleRef = useRef(onToggle);
  onToggleRef.current = onToggle;
  const lastToggleAtRef = useRef(0);
  const touchOriginRef = useRef<{ x: number; y: number } | null>(null);

  const runToggle = () => {
    const now = performance.now();
    if (now - lastToggleAtRef.current < 500) return;
    lastToggleAtRef.current = now;
    const active = document.activeElement;
    if (
      active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement ||
      active instanceof HTMLSelectElement
    ) {
      active.blur();
    }
    onToggleRef.current();
  };

  const onTouchStart = (event: TouchEvent<HTMLButtonElement>) => {
    const touch = event.changedTouches[0];
    touchOriginRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const onTouchEnd = (event: TouchEvent<HTMLButtonElement>) => {
    const origin = touchOriginRef.current;
    const touch = event.changedTouches[0];
    touchOriginRef.current = null;
    if (!origin || !touch) return;
    if (Math.abs(touch.clientX - origin.x) > 12 || Math.abs(touch.clientY - origin.y) > 12) return;
    event.preventDefault();
    runToggle();
  };

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    runToggle();
  };

  return (
    <button type='button' {...props} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onClick={onClick} />
  );
}
