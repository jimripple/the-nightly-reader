const normalized = line => line.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

export function cleanSourceText(text,title){
  const lines=text.trim().split(/\r?\n/);
  const titleIndex=lines.findIndex((line,index)=>index<16&&normalized(line)===normalized(title));
  if(titleIndex<0||lines.slice(0,titleIndex).some(line=>line.trim().length>80))return text.trim();
  let start=titleIndex+1;
  while(!lines[start]?.trim())start++;
  if(/^by\s+.{3,80}$/i.test(lines[start]?.trim()||'')){
    start++;
    while(!lines[start]?.trim())start++;
  }
  if(/^[IVXLC]{1,6}\.?$/i.test(lines[start]?.trim()||'')){
    start++;
    while(!lines[start]?.trim())start++;
  }
  return lines.slice(start).join('\n').trim()||text.trim();
}
