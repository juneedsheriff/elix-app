import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from 'react';
import { FileText, Search, SlidersHorizontal } from 'lucide-react';
import {
  MEDICAL_RECORD_VIEW_FILTERS,
  medicalRecordCategoryId,
  medicalRecordCategoryLabel,
  type MedicalRecordViewFilterId
} from '../../lib/medicalRecordCategories';
import { truncateFileName } from '../../lib/truncateLabel';
import type { MedicalRecord } from '../../types/medicalRecord';
import './medical-record-select-list.css';

type MedicalRecordSelectListProps = {
  records: MedicalRecord[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  disabled?: boolean;
};

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export default function MedicalRecordSelectList({
  records,
  selectedIds,
  onToggle,
  disabled = false
}: MedicalRecordSelectListProps) {
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<MedicalRecordViewFilterId>('all');
  const [categoryFilterMenuOpen, setCategoryFilterMenuOpen] = useState(false);
  const [filterMenuStyle, setFilterMenuStyle] = useState<CSSProperties>({});

  const activeCategoryFilterLabel = useMemo(
    () =>
      MEDICAL_RECORD_VIEW_FILTERS.find((filter) => filter.id === categoryFilter)?.label ?? 'All records',
    [categoryFilter]
  );

  const updateFilterMenuPosition = useCallback(() => {
    const button = filterBtnRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const menuWidth = 280;
    const viewportPadding = 12;
    const left = Math.min(
      Math.max(viewportPadding, rect.right - menuWidth),
      window.innerWidth - menuWidth - viewportPadding
    );

    setFilterMenuStyle({
      top: rect.bottom + 6,
      left
    });
  }, []);

  useLayoutEffect(() => {
    if (!categoryFilterMenuOpen) return;
    updateFilterMenuPosition();
  }, [categoryFilterMenuOpen, updateFilterMenuPosition]);

  useEffect(() => {
    if (!categoryFilterMenuOpen) return;

    const onReposition = () => updateFilterMenuPosition();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);

    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [categoryFilterMenuOpen, updateFilterMenuPosition]);

  useEffect(() => {
    if (!categoryFilterMenuOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.mrs-filter-wrap')) {
        setCategoryFilterMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [categoryFilterMenuOpen]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter((record) => {
      if (categoryFilter !== 'all' && medicalRecordCategoryId(record) !== categoryFilter) return false;
      if (q) {
        const haystack = [
          record.file_name,
          record.summary ?? '',
          medicalRecordCategoryLabel(medicalRecordCategoryId(record))
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [records, searchQuery, categoryFilter]);

  if (records.length === 0) return null;

  return (
    <div className='mrs-select'>
      <div className='mrs-toolbar'>
        <label className='mrs-search'>
          <Search size={16} aria-hidden />
          <input
            type='search'
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder='Search files'
            aria-label='Search medical records'
            disabled={disabled}
          />
        </label>
        <div className='mrs-filter-wrap'>
          <button
            ref={filterBtnRef}
            type='button'
            className={joinClasses(
              'mrs-filter-btn',
              categoryFilterMenuOpen && 'mrs-filter-btn--open',
              categoryFilter !== 'all' && 'mrs-filter-btn--active'
            )}
            onClick={() =>
              setCategoryFilterMenuOpen((open) => {
                const next = !open;
                if (next) {
                  requestAnimationFrame(() => updateFilterMenuPosition());
                }
                return next;
              })
            }
            aria-label={'Filter by record type: ' + activeCategoryFilterLabel}
            aria-expanded={categoryFilterMenuOpen}
            aria-haspopup='listbox'
            disabled={disabled}
          >
            <SlidersHorizontal size={17} aria-hidden />
          </button>
          {categoryFilterMenuOpen ? (
            <ul
              className='mrs-filter-menu mrs-filter-menu--categories'
              role='listbox'
              aria-label='Filter by record type'
              style={filterMenuStyle}
            >
              {MEDICAL_RECORD_VIEW_FILTERS.map((filter) => (
                <li key={filter.id}>
                  <button
                    type='button'
                    role='option'
                    aria-selected={categoryFilter === filter.id}
                    aria-pressed={categoryFilter === filter.id}
                    onClick={() => {
                      setCategoryFilter(filter.id);
                      setCategoryFilterMenuOpen(false);
                    }}
                  >
                    {filter.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {filteredRecords.length !== records.length ? (
        <p className='muted mrs-count'>
          Showing {filteredRecords.length} of {records.length} record{records.length === 1 ? '' : 's'}
        </p>
      ) : null}

      {filteredRecords.length === 0 ? (
        <p className='muted mrs-empty'>No files match your search or filter.</p>
      ) : (
        <ul className='record-select-list'>
          {filteredRecords.map((record) => {
            const category = medicalRecordCategoryId(record);
            return (
              <li key={record.id}>
                <label className='record-select-item'>
                  <input
                    type='checkbox'
                    checked={selectedIds.has(record.id)}
                    onChange={() => onToggle(record.id)}
                    disabled={disabled}
                  />
                  <FileText size={20} aria-hidden />
                  <span className='record-select-text'>
                    <strong title={record.file_name}>{truncateFileName(record.file_name)}</strong>
                    <span className='mrs-category-badge'>{medicalRecordCategoryLabel(category)}</span>
                    {record.summary ? <span className='muted'>{record.summary}</span> : null}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
