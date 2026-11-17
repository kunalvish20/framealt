'use client';

import { memo } from 'react';
import { Pencil, ArrowUpRight, Square, Circle, MapPin, Undo2 } from 'lucide-react';
import type { DrawTool } from '@/lib/annotation';

type Props = { tool: DrawTool | null; onToolChange: (tool: DrawTool | null) => void; count: number; onUndo: () => void; disabled?: boolean; readOnly?: boolean };
function MarkupToolbar({ tool, onToolChange, count, onUndo, disabled = false, readOnly = false }: Props) {
  return <div className="ff-markup-toolbar" role="group" aria-label="Annotation tools"><span>{readOnly ? 'Annotations' : 'Markup'}</span>{!readOnly && <>{([['pen', Pencil, 'Draw'], ['arrow', ArrowUpRight, 'Arrow'], ['rect', Square, 'Box'], ['ellipse', Circle, 'Circle'], ['pin', MapPin, 'Pin']] as const).map(([value, Icon, label]) => <button key={value} type="button" className={tool === value ? 'active' : ''} title={label} aria-label={label} aria-pressed={tool === value} disabled={disabled} onClick={() => onToolChange(tool === value ? null : value)}><Icon size={16}/></button>)}<button type="button" aria-label="Undo last drawing" title="Undo last drawing" onClick={onUndo} disabled={!count}><Undo2 size={16}/></button>{count > 0 && <small>{count} markup{count === 1 ? '' : 's'} / Post to save</small>}</>}</div>;
}
export default memo(MarkupToolbar);
