import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { bump, Btn, Child } from '../../shared/counter.js';

const ESCAPE = 'Escape';

// Counts how many modals are open so the page scroll lock is released by the last one.
const lock = { count: 0 };

function useScrollLock(active) {
  useEffect(() => {
    if (!active) {
      return undefined;
    }
    lock.count += 1;
    document.body.classList.add('modal-open');
    return () => {
      lock.count -= 1;
      if (lock.count === 0) {
        document.body.classList.remove('modal-open');
      }
    };
  }, [active]);
}

function useEscape(active, onClose) {
  const handler = useRef(onClose);
  handler.current = onClose;
  useEffect(() => {
    if (!active) {
      return undefined;
    }
    const listener = (event) => {
      if (event.key === ESCAPE) {
        event.preventDefault();
        handler.current();
      }
    };
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [active]);
}

export function Modal({ open, title, labelledBy, maxWidth, closeOnClickOutside = true, onClose, children }) {
  const contentRef = useRef(null);
  const animationsDisabled = useMemo(
    () => document.body.classList.contains('animations-disabled'),
    [open],
  );

  useScrollLock(open);
  useEscape(open, onClose);

  // Moves focus into the dialog when it opens and gives it back when it closes.
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const previous = document.activeElement;
    bump('focus');
    if (contentRef.current) {
      contentRef.current.focus();
    }
    return () => {
      if (previous && previous.focus) {
        previous.focus();
      }
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const style = maxWidth ? { '--max-width': `${maxWidth}px` } : undefined;

  return (
    <div
      className={'Modal' + (animationsDisabled ? ' animations-disabled' : '')}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <div className="Modal__background" onClick={closeOnClickOutside ? onClose : undefined} />
      <div className="Modal__content" style={style} tabIndex={0} ref={contentRef}>
        <h2 id={labelledBy}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function SettingsDialog({ initialOpen, user, options, closeOnClickOutside }) {
  const [open, setOpen] = useState(initialOpen);
  const [selected, setSelected] = useState(options[0]);
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    globalThis.__dialog = { setOpen, setSelected };
  }, []);

  const close = useCallback(() => setOpen(false), []);
  const save = () => {
    bump('save');
    setSaved(selected);
    setOpen(false);
  };

  const choices = options.map((option) => ({ option, active: option === selected }));

  return (
    <div>
      <Btn onClick={() => setOpen(true)} label={`Settings for ${user}`} />
      <Child v={saved === null ? 'not saved' : `saved ${saved}`} />
      <Modal
        open={open}
        title="Settings"
        labelledBy="settings-title"
        maxWidth={480}
        closeOnClickOutside={closeOnClickOutside}
        onClose={close}
      >
        <ul>
          {choices.map(({ option, active }) => (
            <li key={option} className={active ? 'active' : ''}>
              <label>
                <input
                  type="radio"
                  name="option"
                  checked={active}
                  onChange={() => setSelected(option)}
                />
                {option}
              </label>
            </li>
          ))}
        </ul>
        <Btn onClick={save} label="Save" />
        <Btn onClick={close} label="Cancel" />
      </Modal>
    </div>
  );
}
