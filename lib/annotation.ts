export type DrawTool='pen'|'arrow'|'rect'|'ellipse'|'pin';
export type Point={x:number;y:number};
export type ReviewMark={id:string;type:DrawTool;points:Point[];color:string};
const tools=['pen','arrow','rect','ellipse','pin'];
export function validReviewMarks(value:unknown): value is ReviewMark[]{
 if(!Array.isArray(value)||value.length>25)return false;
 return value.every(mark=>typeof mark==='object'&&mark!==null&&
  typeof mark.id==='string'&&mark.id.length<=100&&tools.includes(mark.type)&&
  typeof mark.color==='string'&&/^#[0-9a-fA-F]{6}$/.test(mark.color)&&
  Array.isArray(mark.points)&&mark.points.length>=1&&mark.points.length<=160&&
  mark.points.every((p:unknown)=>typeof p==='object'&&p!==null&&
   Number.isFinite((p as Point).x)&&Number.isFinite((p as Point).y)&&
   (p as Point).x>=0&&(p as Point).x<=1&&(p as Point).y>=0&&(p as Point).y<=1));
}
