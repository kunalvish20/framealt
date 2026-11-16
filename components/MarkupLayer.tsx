'use client';
import {useRef,useState} from 'react';
import type {PointerEvent} from 'react';
import type {DrawTool,Point,ReviewMark} from '@/lib/annotation';
import {validReviewMarks} from '@/lib/annotation';
type Props={marks:ReviewMark[];onChange?:(marks:ReviewMark[])=>void;tool:DrawTool|null;readOnly?:boolean};
function xy(e:PointerEvent<SVGSVGElement>):Point{const r=e.currentTarget.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))}}
function Shape({mark}:{mark:ReviewMark}){
 const [a,b=a]=[mark.points[0],mark.points[mark.points.length-1]];const X=(n:number)=>n*1000,Y=(n:number)=>n*1000;
 if(mark.type==='pin')return <g><circle cx={X(a.x)} cy={Y(a.y)} r="20" fill={mark.color} stroke="white" strokeWidth="5"/><circle cx={X(a.x)} cy={Y(a.y)} r="6" fill="white"/></g>;
 if(mark.type==='pen')return <polyline fill="none" stroke={mark.color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="8" points={mark.points.map(p=>`${X(p.x)},${Y(p.y)}`).join(' ')}/>;
 if(mark.type==='rect')return <rect x={Math.min(X(a.x),X(b.x))} y={Math.min(Y(a.y),Y(b.y))} width={Math.abs(X(a.x)-X(b.x))} height={Math.abs(Y(a.y)-Y(b.y))} fill="none" stroke={mark.color} strokeWidth="8"/>;
 if(mark.type==='ellipse')return <ellipse cx={(X(a.x)+X(b.x))/2} cy={(Y(a.y)+Y(b.y))/2} rx={Math.abs(X(a.x)-X(b.x))/2} ry={Math.abs(Y(a.y)-Y(b.y))/2} fill="none" stroke={mark.color} strokeWidth="8"/>;
 const ang=Math.atan2(Y(b.y)-Y(a.y),X(b.x)-X(a.x));const head=26;
 const h1=`${X(b.x)-head*Math.cos(ang-.6)},${Y(b.y)-head*Math.sin(ang-.6)}`;
 const h2=`${X(b.x)-head*Math.cos(ang+.6)},${Y(b.y)-head*Math.sin(ang+.6)}`;
 return <g fill="none" stroke={mark.color} strokeWidth="8" strokeLinecap="round"><path d={`M${X(a.x)} ${Y(a.y)} L${X(b.x)} ${Y(b.y)}`}/><path d={`M${h1.replace(',',' ')} L${X(b.x)} ${Y(b.y)} L${h2.replace(',',' ')}`}/></g>;
}
export default function MarkupLayer({marks,onChange,tool,readOnly=false}:Props){
 const [preview,setPreview]=useState<ReviewMark|null>(null);const drawing=useRef<ReviewMark|null>(null);
 const enabled=!!tool&&!readOnly&&!!onChange;
 function start(e:PointerEvent<SVGSVGElement>){if(!enabled||!tool)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);const p=xy(e);const mark:ReviewMark={id:crypto.randomUUID(),type:tool,points:[p],color:'#ffcf4e'};drawing.current=mark;setPreview(mark);}
 function move(e:PointerEvent<SVGSVGElement>){if(!drawing.current)return;const p=xy(e);const old=drawing.current;const points=old.type==='pen'?[...old.points,p].slice(-160):old.type==='pin'?[old.points[0]]:[old.points[0],p];const next={...old,points};drawing.current=next;setPreview(next);}
 function end(e:PointerEvent<SVGSVGElement>){if(!drawing.current)return;const mark=drawing.current;drawing.current=null;setPreview(null);if(mark.type==='pin'||mark.points.length>1)onChange?.([...marks,mark]);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}
 return <svg className={`ff-markup-layer ${enabled?'ff-markup-drawing':''}`} viewBox="0 0 1000 1000" preserveAspectRatio="none" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} aria-label={enabled?'Draw an annotation':'Annotation overlay'}>
 {validReviewMarks(marks)&&marks.map(mark=><Shape mark={mark} key={mark.id}/>)}{preview&&<Shape mark={preview}/>}</svg>;
}
