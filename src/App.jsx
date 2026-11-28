import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  GraduationCap, LayoutDashboard, BookOpen, Target, CalendarDays, CheckCircle2,
  XCircle, Plus, FolderOpen, FolderClosed, ChevronDown, ChevronRight, ArrowLeft,
  Pencil, Trash2, BookMarked, Save, Download, Upload, Layers3, TrendingUp,
  ChartNoAxesColumnIncreasing, ShieldCheck, ClipboardCheck, Info, CircleAlert,
  FolderPlus, FolderKanban, Calculator, Sparkles, Trophy, Menu, X, GripVertical,
} from 'lucide-react';
import {
  DEFAULT_SCALE, GRADE_LETTERS, CREDIT_GOAL, DEFAULT_FUTURE_CREDITS,
  uid, createYear, createSemester, createCourse, GROUP_EXAM_FIELDS, examKeyForAssessment, yearStats, reorderAssessments, gradeForScore,
  evaluateCourse, semesterStats, cumulativeStats, allSemesters,
  lastCurrentTermOrder, termOrder, projectGoal, makeSampleData,
} from './lib/grades.js';
import { loadData, saveData, isValidData, normalizeData, downloadBackup } from './lib/storage.js';
import { mergeDocuments } from './lib/merge.js';
import { isFolderOpen, toggleFolder, toggleExamStats } from './lib/folders.js';
import { AuthPanel, CloudChoice, CloudConflict, AccountHeader } from './Auth.jsx';
import { useAccountSync } from './useAccountSync.js';
import { supabase } from './lib/cloud.js';
import { NEW_ROW_ID, emptyCalculatorRow, calculatorRows, calculateDraftGpa } from './lib/calculator.js';

const gradeFormat = value => value === null || !Number.isFinite(value) ? '—' : value.toFixed(2);
const numberFormat = value => Number(value).toLocaleString('th-TH', { maximumFractionDigits: 2 });
const gradingRange = (row, index, scale, fullScore) => {
  const full = Number(fullScore);
  const lower = Number(row.min);
  const upper = index === 0 ? full : Math.max(lower, Number(scale[index - 1].min) - 0.01);
  return `${numberFormat(lower)}–${numberFormat(upper)} คะแนน`;
};
const termName = sem => sem.number === 1 ? 'เทอม 1' : 'เทอม 2';
const statusText = { completed: 'เรียนจบแล้ว', current: 'กำลังเรียน', planned: 'วางแผนไว้' };
const clone = obj => structuredClone(obj);
const byId = (data, yid, sid, cid) => {
  const year = data.years.find(y => y.id === yid);
  const semester = year?.semesters.find(s => s.id === sid);
  const course = semester?.courses.find(c => c.id === cid);
  return { year, semester, course };
};

function GradeculatorMark() {
  return <img className="gradeculator-logo" src={`${import.meta.env.BASE_URL}icons/logo-round.svg`} alt="Gradeculator" draggable="false"/>;
}

function Brand({ onClick }) {
  return <button type="button" className="brand" onClick={onClick} aria-label="ไป Dashboard">
    <span className="brand-mark"><GradeculatorMark/></span>
    <span className="brand-name">Gradeculator</span>
  </button>;
}

function Header({ page, onPage, onExport, onImport, user, syncStatus, onLogin, onLogout, onRefresh }) {
  const [showMobile, setShowMobile] = useState(false);
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'courses', label: 'Courses', icon: BookOpen },
    { id: 'destination', label: 'Calculator', icon: Calculator },
  ];
  return <header className="topbar">
    <div className="topbar-inner">
      <Brand onClick={() => { onPage('dashboard'); setShowMobile(false); }}/>
      <nav className={showMobile ? 'main-nav mobile-open' : 'main-nav'} aria-label="เมนูหลัก">
        {items.map(item => <button type="button" key={item.id} className={'nav-btn ' + (page === item.id ? 'active' : '')}
          onClick={() => { onPage(item.id); setShowMobile(false); }}>
          <item.icon size={19} strokeWidth={2.3}/><span>{item.label}</span>
        </button>)}
      </nav>
      <div className="header-tools">
        <AccountHeader user={user} syncStatus={syncStatus} onLogin={onLogin} onLogout={onLogout} onRefresh={onRefresh} onExport={onExport} onImport={onImport}/>
        <button type="button" aria-label="เปิดเมนู" className="header-icon-btn menu-btn" onClick={() => setShowMobile(x => !x)}>{showMobile ? <X size={22}/> : <Menu size={22}/>}</button>
      </div>
    </div>
  </header>;
}

function Splash() {
  return <div className="splash" role="status" aria-label="กำลังเปิด Gradeculator">
    <div className="splash-content">
      <span className="splash-brand-mark"><img src={`${import.meta.env.BASE_URL}icons/logo-splash.svg`} alt="Gradeculator" /></span>
      <div className="splash-title">Welcome to <span>Gradeculator</span>.</div>
      <p>ให้เราช่วยคำนวณผลการเรียนของคุณ</p>
      <span className="splash-loader" aria-hidden="true"/>
    </div>
  </div>;
}

function StatCard({ label, value, detail, color = 'blue', icon: Icon }) {
  return <div className="stat-card">
    <div className="stat-copy"><p className="stat-label">{label}</p><strong>{value}</strong><p className="stat-detail">{detail}</p></div>
    <span className={'stat-icon ' + color}><Icon size={30} strokeWidth={2.5}/></span>
  </div>;
}

function EmptyState({ icon: Icon, title, detail, action, onAction }) {
  return <div className="empty-state">
    <span className="empty-icon"><Icon size={30}/></span>
    <h3>{title}</h3><p>{detail}</p>
    {action && <button className="btn btn-primary" onClick={onAction}><Plus size={18}/>{action}</button>}
  </div>;
}

function Dashboard({ data, onCourses, onSample, onToggleTermGpa }) {
  const summary = useMemo(() => cumulativeStats(data), [data]);
  const terms = useMemo(() => allSemesters(data), [data]);
  return <main className="page page-dashboard">
    <div className="page-heading dashboard-heading">
      <div><div className="eyebrow">YOUR ACADEMIC OVERVIEW</div><h1>ยินดีต้อนรับสู่แดชบอร์ด</h1></div>
      <button className="btn btn-outline" onClick={onCourses}><BookOpen size={18}/>จัดการรายวิชา</button>
    </div>
    <div className="section-title"><div><h2>GPA · เกรดเฉลี่ยรวม</h2></div><span className="mini-tag"><ShieldCheck size={15}/>คำนวณอัตโนมัติ</span></div>
    <div className="stats-grid">
      <StatCard label="GPA ปัจจุบัน" value={gradeFormat(summary.gpa)} detail="จาก 4.00" icon={ChartNoAxesColumnIncreasing}/>
      <StatCard label="หน่วยกิตรวม" value={numberFormat(summary.passedCredits)} detail={`จากหลักสูตร ${CREDIT_GOAL} หน่วยกิต`} icon={CalendarDays}/>
      <StatCard label="รายวิชาที่ผ่าน" value={summary.passed} detail={`จากทั้งหมด ${summary.total} วิชา`} icon={CheckCircle2} color="green"/>
      <StatCard label="รายวิชาที่ตก" value={summary.failed} detail={`จากทั้งหมด ${summary.total} วิชา`} icon={XCircle} color="red"/>
    </div>
    <div className="dashboard-credits-progress" aria-label={`เรียนผ่านแล้ว ${numberFormat(summary.graduationCredits)} จาก ${CREDIT_GOAL} หน่วยกิต`}>
      <div className="credits-bar"><span style={{width: `${Math.min(100, (summary.graduationCredits / CREDIT_GOAL) * 100)}%`}}/></div>
      <div className="credits-progress"><strong>{numberFormat(summary.graduationCredits)} / {CREDIT_GOAL}</strong><span>หน่วยกิตที่ผ่าน</span></div>
    </div>
    <div className="section-title section-space"><div><h2>GPA · เกรดเฉลี่ยรายเทอม</h2></div></div>
    {terms.length === 0 ? <EmptyState icon={FolderKanban} title="ยังไม่มีข้อมูลเทอม" detail="เริ่มต้นโดยเพิ่มปีการศึกษา เทอม และรายวิชาที่หน้า Courses" action="ไปเพิ่มรายวิชา" onAction={onCourses}/> :
      <div className="term-overview-list">{terms.map(({ year, semester }) => {
        const stats = semesterStats(semester);
        return <article className="term-overview-card" key={semester.id}>
          <div className="term-overview-top"><div className="term-overview-title"><span className="term-num"><CalendarDays size={19}/></span><div><h3>ปีที่ {year.number} · {termName(semester)}</h3><span className={'status-pill ' + semester.status}>{statusText[semester.status] ?? 'วางแผนไว้'}</span></div></div><div className="term-overview-right">
  <label className="term-gpa-switch"><input type="checkbox" checked={semester.includeInGpa !== false}
    onChange={() => onToggleTermGpa(semester.id)} aria-label={`นับปีที่ ${year.number} ${termName(semester)} ใน GPA รวม`}/>
    <span className="term-gpa-switch-track" aria-hidden="true"/><span className="term-gpa-switch-label">{semester.includeInGpa === false ? 'ไม่นับ GPA รวม' : 'นับ GPA รวม'}</span></label>
  <strong className="term-overview-gpa">{gradeFormat(stats.gpa)}<small> / 4.00</small></strong>
</div></div>
          <div className="term-metrics"><div><span>หน่วยกิตลงทะเบียน</span><strong>{numberFormat(stats.credits)}</strong></div><div><span>หน่วยกิตที่ได้เกรด</span><strong>{numberFormat(stats.gradedCredits)}</strong></div><div><span>ผ่าน</span><strong className="success-text">{stats.passed}</strong></div><div><span>ตก</span><strong className="danger-text">{stats.failed}</strong></div></div>
        </article>;
      })}</div>}
    {data.years.length === 0 && <button className="link-example" onClick={onSample}><Sparkles size={16}/>ลองใส่ข้อมูลตัวอย่างเพื่อดูหน้าตา</button>}
  </main>;
}

function IconButton({ label, icon: Icon, onClick, danger = false }) {
  return <button className={'small-icon-btn ' + (danger ? 'danger' : '')} type="button" title={label} aria-label={label} onClick={onClick}><Icon size={17}/></button>;
}

function Courses({ data, onToggleYear, onToggleTerm, onAddYear, onEditYear, onDeleteYear, onAddTerm, onEditTerm, onDeleteTerm, onAddCourse, onEditCourse, onDeleteCourse, onSelectCourse, onSample }) {
  return <main className="page page-courses">
    <div className="page-heading course-heading">
      <div><div className="eyebrow">COURSE MANAGEMENT</div><h1>จัดการรายวิชา</h1><p>จัดการข้อมูลของคุณพร้อมการติดตามผลการเรียน</p></div>
      <button className="btn btn-primary" onClick={onAddYear}><Plus size={19}/>เพิ่มปีการศึกษา</button>
    </div>
    {data.years.length === 0 ? <div className="empty-panel"><EmptyState icon={FolderPlus} title="เริ่มต้นจัดระเบียบผลการเรียน" detail="กดปุ่มเพิ่มปีการศึกษาด้านบน แล้วเพิ่มเทอมเพื่อเริ่มจัดเก็บรายวิชาของคุณ"/></div> :
      <div className="years-list">{[...data.years].sort((a,b)=>a.number-b.number).map(year => {
        const isYearOpen = isFolderOpen(data, 'year', year.id);
        const yearGpa = yearStats(year).gpa;
        return <section className="year-panel" key={year.id}>
          <div className="year-header"><button className="folder-toggle" aria-expanded={isYearOpen} aria-label={`แสดงหรือซ่อนปีการศึกษาที่ ${year.number}`} onClick={() => onToggleYear(year.id)}>
            <span className="folder-symbol">{isYearOpen ? <FolderOpen size={24}/> : <FolderClosed size={24}/>}</span>
            <span><strong>ปีการศึกษาที่ {year.number}</strong><small>{year.semesters.length} เทอม · {year.semesters.reduce((sum,s)=>sum+s.courses.length,0)} วิชา</small></span>
            {isYearOpen ? <ChevronDown className="folder-chevron" size={19}/> : <ChevronRight className="folder-chevron" size={19}/>}</button>
            <span className="year-inline-gpa" title="GPA เฉพาะปีนี้ จากวิชาที่มีเกรดแล้ว">GPA {gradeFormat(yearGpa)}</span>
            <div className="year-actions"><button className="btn btn-outline btn-small" title="เพิ่มเทอม" aria-label={`เพิ่มเทอมในปี ${year.number}`} onClick={() => onAddTerm(year.id)}><Plus size={17}/>เพิ่มเทอม</button><IconButton label="แก้ไขปี" icon={Pencil} onClick={() => onEditYear(year.id)}/><IconButton label="ลบปี" icon={Trash2} danger onClick={() => onDeleteYear(year.id)}/></div>
          </div>
          {isYearOpen && <div className="year-content">{year.semesters.length === 0 ? <div className="no-terms">ยังไม่มีเทอมในปีนี้ <button className="text-link" onClick={() => onAddTerm(year.id)}>+ เพิ่มเทอมแรก</button></div> :
            [...year.semesters].sort((a,b)=>a.number-b.number).map(sem => {
              const isOpen = isFolderOpen(data, 'term', sem.id);
              const stats = semesterStats(sem);
              return <div className="semester-panel" key={sem.id}>
                <div className="semester-heading"><button className="semester-toggle" aria-expanded={isOpen} aria-label={`แสดงหรือซ่อนปี ${year.number} เทอม ${sem.number}`} onClick={() => onToggleTerm(sem.id)}>
                  <span className="semester-circle"><CalendarDays size={19}/></span>
                  <span className="semester-heading-text"><strong>{termName(sem)}</strong><small>{sem.courses.length} วิชา · {numberFormat(stats.credits)} หน่วยกิต</small></span>
                  <span className={'status-pill ' + sem.status}>{statusText[sem.status] ?? 'วางแผนไว้'}</span>
                  <strong className="semester-inline-gpa">GPA {gradeFormat(stats.gpa)}</strong>
                  {isOpen ? <ChevronDown size={18} className="muted-icon"/> : <ChevronRight size={18} className="muted-icon"/>}
                </button><div className="term-actions"><IconButton label="แก้ไขเทอม" icon={Pencil} onClick={() => onEditTerm(year.id,sem.id)}/><IconButton label="ลบเทอม" icon={Trash2} danger onClick={() => onDeleteTerm(year.id,sem.id)}/></div></div>
                {isOpen && <div className="semester-body">
                  {sem.courses.length ? <div className="course-table-wrap"><table className="course-table"><thead><tr><th>ชื่อรายวิชา</th><th>หน่วยกิต</th><th>คะแนนรวม</th><th>เกรด</th><th>จัดการ</th></tr></thead><tbody>
                    {sem.courses.map(course => {
                      const val = evaluateCourse(course);
                      return <tr key={course.id}>
                        <td><button className="course-name-link" onClick={() => onSelectCourse(year.id,sem.id,course.id)}><strong>{course.name}</strong>{course.code && <small>{course.code}</small>}</button></td>
                        <td>{numberFormat(course.credits)}</td>
                        <td>{numberFormat(val.earned)} / {numberFormat(course.maxScore)}{!val.isFinal && <small className="cell-hint">ยังไม่สรุป</small>}</td>
                        <td>{val.isFinal ? <span className={'grade-chip table-grade '+(val.grade==='F'?'grade-f':'')}>{val.grade}</span> : <span className="grade-pending">รอเกรด</span>}</td>
                        <td><div className="table-actions"><IconButton label="ดูคะแนนย่อย" icon={ChevronRight} onClick={() => onSelectCourse(year.id,sem.id,course.id)}/><IconButton label="แก้ไขวิชา" icon={Pencil} onClick={() => onEditCourse(year.id,sem.id,course.id)}/><IconButton label="ลบวิชา" icon={Trash2} danger onClick={() => onDeleteCourse(year.id,sem.id,course.id)}/></div></td>
                      </tr>;
                    })}</tbody></table></div> : <div className="no-courses"><BookMarked size={24}/>ยังไม่มีวิชาในเทอมนี้</div>}
                  <button className="btn btn-add-course" onClick={() => onAddCourse(year.id,sem.id)}><Plus size={19}/>เพิ่มรายวิชา</button>
                </div>}
              </div>;
            })}
          </div>}
        </section>;
      })}</div>}
  </main>;
}

function CourseDetail({ year, semester, course, onBack, onEditCourse, onAddAssessment, onEditAssessment, onRemoveAssessment, onEditEarned, onStatus, onReorderAssessment, onEditGroupStat, onEditBonus, onAddBonus, expandedExamStats, onToggleExamStats }) {
  const stats = evaluateCourse(course);
  const scoreProgressPercent = course.maxScore > 0 ? Math.min(100, Math.max(0, stats.earned / course.maxScore * 100)) : 0;
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const draggingRef = useRef(null);
  const onPointerStart = (event, assessmentId) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    draggingRef.current = assessmentId;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(assessmentId);
    setDragOver(null);
  };
  const onPointerMove = event => {
    if (!draggingRef.current) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-assessment-id]');
    setDragOver(target?.dataset.assessmentId ?? null);
  };
  const endDrag = event => {
    const targetId = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-assessment-id]')?.dataset.assessmentId ?? dragOver;
    if (draggingRef.current && targetId && draggingRef.current !== targetId) {
      onReorderAssessment(draggingRef.current, targetId);
    }
    draggingRef.current = null;
    setDragging(null);
    setDragOver(null);
  };
  const cancelDrag = () => { draggingRef.current = null; setDragging(null); setDragOver(null); };
  return <main className="page page-detail">
    <button className="back-btn" onClick={onBack}><ArrowLeft size={19}/>กลับไปหน้ารายวิชา</button>
    <div className="detail-header-card">
      <div className="detail-title-block"><div className="eyebrow">ปีที่ {year.number} / {termName(semester)}</div><h1>{course.name}</h1><p>{course.code || 'ยังไม่ได้ระบุรหัสวิชา'} · {numberFormat(course.credits)} หน่วยกิต</p></div>
      <button className="btn btn-outline" onClick={onEditCourse}><Pencil size={17}/>แก้ไขข้อมูลวิชา</button>
      <div className="detail-summary-grid">
        <div><span>คะแนนรวม (รวมโบนัส)</span><strong>{numberFormat(stats.earned)} <small>/ {numberFormat(course.maxScore)}</small></strong></div>
        <div><span>จัดสรรคะแนนเต็ม</span><strong>{numberFormat(stats.totalAllocated)} <small>/ {numberFormat(course.maxScore)}</small></strong></div>
        <div><span>เกรด {course.gradingMode === 'manual' ? '(กำหนดเอง)' : course.gradingMode === 'group' ? '(อิงกลุ่ม)' : '(อัตโนมัติ)'}</span><strong className={stats.grade === 'F' ? 'danger-text' : 'highlight-text'}>{stats.grade ?? 'รอเกรด'}</strong></div>
      </div>
    </div>
    <div className="detail-content">
      <section className="white-panel">
        <div className="panel-title-row"><div><h2>รายการคะแนนเก็บ</h2><p>เพิ่มหัวข้อคะแนน แล้วกรอกคะแนนที่ได้ในแต่ละรายการ</p></div><button className="btn btn-primary" onClick={() => onAddAssessment()}><Plus size={19}/>เพิ่มคะแนนเก็บ</button></div>
        {course.assessments.length === 0 ? <EmptyState icon={ClipboardCheck} title="ยังไม่มีคะแนนเก็บ" detail="เพิ่มรายการเพื่อเริ่มบันทึกคะแนน คะแนนสอบที่ยังไม่เพิ่มจะไม่ถูกนับในการคำนวณ"/> :
          <div className="assessment-list">{course.assessments.map((item, index) => <div className={'assessment-row ' + (dragging === item.id ? 'is-dragging ' : '') + (dragOver === item.id && dragging !== item.id ? 'is-drop-target ' : '') + (examKeyForAssessment(item) ? 'has-exam-statistics' : '')} data-assessment-id={item.id} key={item.id}>
            <button type="button" className="assessment-drag-handle" title="ลากเพื่อเปลี่ยนลำดับ (หรือใช้ปุ่มลูกศรบนแป้นพิมพ์)" aria-label={'ย้ายลำดับ ' + item.label} onPointerDown={event => onPointerStart(event,item.id)} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={cancelDrag} onKeyDown={event => { if(event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return; event.preventDefault(); const toIndex = index + (event.key === 'ArrowUp' ? -1 : 1); if(course.assessments[toIndex]) onReorderAssessment(item.id,course.assessments[toIndex].id); }}><GripVertical size={22}/></button>
            <div className="assessment-info">
              <strong>{item.label}</strong>
              <span>{item.type === 'bonus' ? 'คะแนนพิเศษ' : `คะแนนเต็ม ${numberFormat(item.maxPoints)} คะแนน`}</span>
              {examKeyForAssessment(item) && <button
                type="button"
                className="exam-details-toggle"
                title="คลิกเพื่อดูหรือซ่อน Min, Max, Avg, Std และ N"
                aria-expanded={expandedExamStats.includes(item.id)}
                aria-controls={`exam-stats-${item.id}`}
                onClick={() => onToggleExamStats(item.id)}>
                {expandedExamStats.includes(item.id) ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}
                <span>{expandedExamStats.includes(item.id) ? 'ซ่อนรายละเอียดการสอบ' : 'รายละเอียดการสอบ'}</span>
              </button>}
            </div>
            {item.type === 'bonus' ? <div className="bonus-row-fields">
              <label className="bonus-description"><span>รายละเอียดโบนัส</span><input type="text" maxLength={200} placeholder="เช่น +1+2" value={item.breakdown ?? ''} aria-label="รายละเอียดคะแนน Bonus" onChange={e => onEditBonus(item.id,'breakdown',e.target.value)}/></label>
              <label className="bonus-points"><span>คะแนนที่ได้ (นำไปคำนวณคะแนน)</span><input className={'score-input ' + ((item.earned === '' || item.earned == null) ? 'no-score' : item.status === 'red' ? 'red-score' : 'green-score')} type="number" min="0" step="any" inputMode="decimal" placeholder="เช่น 5" value={item.earned ?? ''} onChange={e => onEditEarned(item.id,e.target.value)}/></label>
            </div> : <div className="score-entry"><input className={'score-input ' + ((item.earned === '' || item.earned == null) ? 'no-score' : item.status === 'red' ? 'red-score' : 'green-score')} type="number" inputMode="decimal" min="0" max={item.maxPoints} step="any" value={item.earned ?? ''} placeholder="—" aria-label={'คะแนนที่ได้ ' + item.label} onChange={event => onEditEarned(item.id,event.target.value)}/><span className="score-divider">/ {numberFormat(item.maxPoints)}</span></div>}
            <div className="assessment-controls">
              <div className="assessment-marker-wrap">
                <span className="assessment-marker-label">ทำสัญลักษณ์กำกับคะแนน</span>
                <div className="score-flags">
                  <div className="assessment-control-item"><button type="button" className={'flag-btn green ' + (item.status !== 'red' ? 'chosen' : '')} onClick={() => onStatus(item.id,'green')} title="ประกาศ" aria-label="ประกาศ"><CheckCircle2 size={22}/></button><small>ประกาศ</small></div>
                  <div className="assessment-control-item"><button type="button" className={'flag-btn red ' + (item.status === 'red' ? 'chosen' : '')} onClick={() => onStatus(item.id,'red')} title="คาดการณ์" aria-label="คาดการณ์"><XCircle size={22}/></button><small>คาดการณ์</small></div>
                </div>
              </div>
              <div className="assessment-actions">
                {item.type !== 'bonus' && <div className="assessment-control-item"><IconButton label="แก้ไขหัวข้อคะแนน" icon={Pencil} onClick={() => onEditAssessment(item.id)}/><small>แก้ไข</small></div>}
                <div className="assessment-control-item"><IconButton label="ลบหัวข้อคะแนน" icon={Trash2} danger onClick={() => onRemoveAssessment(item.id)}/><small>ลบ</small></div>
              </div>
            </div>
            {examKeyForAssessment(item) &&
              <div className="assessment-inline-stats" id={`exam-stats-${item.id}`} hidden={!expandedExamStats.includes(item.id)} role="region" aria-label={`รายละเอียดการสอบ ${item.label}`}>
                <span className="inline-stats-note">ข้อมูลสถิติของห้อง · ไม่บังคับกรอก และไม่ส่งผลต่อ GPA</span>
                <div className="inline-stats-fields">{GROUP_EXAM_FIELDS.map(field =>
                  <label key={field.key} className="inline-stat-field">
                    <span>{field.label}{field.key === 'n' ? ' (คน)' : ' (ถ้ามี)'}</span>
                    <input type="number" inputMode="decimal" min="0" step={field.key === 'n' ? '1' : 'any'}
                      value={course.groupStats?.[examKeyForAssessment(item)]?.[field.key] ?? ''}
                      onChange={event => onEditGroupStat(examKeyForAssessment(item), field.key, event.target.value)}
                      placeholder="—" aria-label={`${field.label} ของ ${item.label}`}/>
                  </label>)}</div>
              </div>}
          </div>)}</div>}
        <div className="quick-exam-links">
          <div><strong>ทางลัดรายการสอบ</strong><span>รายการที่ยังไม่เพิ่มจะไม่ถูกนับเป็นคะแนน</span></div>
          {['Midterm', 'Final'].filter(label => !course.assessments.some(a => a.label.trim().toLowerCase() === label.toLowerCase())).map(label =>
            <button key={label} type="button" className="quick-exam-btn" onClick={() => onAddAssessment(label)}><Plus size={15}/>{label}<span>ยังไม่เพิ่ม</span></button>)}
          {!course.assessments.some(a => a.type === 'bonus') && <button type="button" className="quick-exam-btn" onClick={onAddBonus}><Plus size={15}/>Bonus<span>เพิ่มคะแนนพิเศษ</span></button>}
        </div>
        <div className="allocation-box"><div className="allocation-top"><span>คะแนนที่ทำได้ / คะแนนเต็ม</span><strong>{numberFormat(stats.earned)} / {numberFormat(course.maxScore)}</strong></div><div className="progress-track"><span style={{ width: `${scoreProgressPercent}%` }}/></div>
          {stats.totalAllocated > Number(course.maxScore) ? <p className="form-warning"><CircleAlert size={16}/>คะแนนเต็มรวมเกินคะแนนเต็มรายวิชา กรุณาแก้ไข</p> : stats.totalAllocated < Number(course.maxScore) ? <p className="muted-help">ยังเหลือคะแนนเต็มให้จัดสรรอีก {numberFormat(course.maxScore-stats.totalAllocated)} คะแนน · เกรดอัตโนมัติจะยังไม่สรุป</p> : <p className="success-help"><CheckCircle2 size={15}/>จัดสรรคะแนนครบแล้ว {stats.allRecorded ? 'ข้อมูลครบ พร้อมสรุปเกรด' : 'รอกรอกคะแนนที่ยังไม่มีผล'}</p>}
        </div>
      </section>
      <section className="white-panel rules-panel"><div className="panel-title-row"><div><h2>เกณฑ์การตัดเกรด</h2><p>{course.gradingMode === 'automatic' ? `เกณฑ์คะแนนดิบตามคะแนนเต็มรายวิชา (${numberFormat(course.maxScore)} คะแนน) ไม่ใช่เปอร์เซ็นต์` : course.gradingMode === 'group' ? 'ข้อมูลอ้างอิงและเกรดที่อาจารย์ประกาศสำหรับวิชาอิงกลุ่ม' : 'เกรดที่กำหนดไว้สำหรับวิชานี้'}</p></div><button className="btn btn-outline" onClick={onEditCourse}><Pencil size={16}/>แก้เกณฑ์</button></div>
        {course.gradingMode === 'manual' && <div className="manual-note"><Info size={19}/>กำหนดเกรดเอง: ใช้เกรดที่เลือกเป็นผลสุดท้ายทันที ไม่อิงคะแนนย่อย</div>}
        {course.gradingMode === 'group' && <div className="group-grade-details">
          <div><span>คาดว่าเริ่มได้ A ประมาณ</span><strong>{course.groupCutoffA === '' || course.groupCutoffA == null ? 'ยังไม่ระบุ' : `${numberFormat(course.groupCutoffA)} คะแนน`}</strong></div>
          <div><span>คาดว่าต่ำกว่าเกณฑ์ F ประมาณ</span><strong>{course.groupCutoffF === '' || course.groupCutoffF == null ? 'ยังไม่ระบุ' : `${numberFormat(course.groupCutoffF)} คะแนน`}</strong></div>
          <div><span>เกรดที่ประกาศ</span><strong className="highlight-text">{stats.grade ?? 'ยังไม่ประกาศ'}</strong></div>
          <p className="muted-help">เกณฑ์ A/F เป็นตัวเลขประมาณการ ส่วนเกรดจริงต้องเลือกตามที่อาจารย์ประกาศ ไม่ได้อนุมานเกรดจากสถิติสอบ</p>
        </div>}
        {course.gradingMode === 'automatic' && <div className="grade-scale-list">{(course.scale ?? DEFAULT_SCALE).map((row,index,arr) => <div className="scale-row" key={row.letter}><span className={'grade-chip ' + (row.letter === 'F' ? 'grade-f' : '')}>{row.letter}</span><strong>{gradingRange(row,index,arr,course.maxScore)}</strong><small>{row.point.toFixed(1)} GPA</small></div>)}</div>}
      </section>
      <div className="dashboard-tip"><Info size={19}/><p>ปุ่มวงกลมสีเขียว/แดงใช้เปลี่ยนสีตัวเลขที่กรอกเพื่อทำเครื่องหมายตามที่ต้องการ ไม่ได้ทำให้คะแนนเพิ่มหรือลด การคำนวณ GPA จะใช้เกรดเมื่อคะแนนทุกส่วนครบ หรือเมื่อเลือกกำหนดเกรดเอง</p></div>
    </div>
  </main>;
}

function Destination({ data, onChangeDraft, onAddDraftRow, onRemoveDraftRow, onClearDraft }) {
  const boundary = lastCurrentTermOrder(data);
  const nextOrder = Math.min(12, Math.max(1, boundary+1));
  const [goal, setGoal] = useState('3.50');
  const [year, setYear] = useState(String(Math.ceil(nextOrder/2)));
  const [semester, setSemester] = useState(String(nextOrder%2===1 ? 1:2));
  const [credits, setCredits] = useState(String(DEFAULT_FUTURE_CREDITS));
  const [calculated, setCalculated] = useState(false);
  const validChosen = termOrder(year, semester) > boundary;
  const result = useMemo(() => calculated ? projectGoal(data, goal.trim() === '' ? NaN : Number(goal), Number(year), Number(semester), Number(credits)) : null, [calculated, data, goal, year, semester, credits]);
  const choices = Array.from({length: 12}, (_,i) => ({ year: Math.ceil((i+1)/2), term: (i+1)%2===1?1:2, order:i+1 }));
  const savedDraft = calculatorRows(data);
  const draftRows = savedDraft.length ? savedDraft : [emptyCalculatorRow()];
  const draftResult = calculateDraftGpa(draftRows);
  const draftGrades = new Map(draftResult.details.map(item => [item.id, item]));
  return <main className="page page-destination">
    <div className="page-heading"><div><div className="eyebrow">GRADE CALCULATOR</div><h1>คำนวณเกรด</h1><p>วางแผน GPA เป้าหมาย และทดลองคำนวณเกรดจากรายวิชาแยกจากข้อมูลจริง</p></div><span className="destination-head-icon"><Target size={33}/></span></div>
    <div className="destination-layout">
      <section className="white-panel destination-form">
        <div className="panel-title-row"><div><h2>วางแผนเป้าหมายระยะยาว</h2><p>ระบุเกรดเฉลี่ยเป้าหมายและเทอมที่ต้องการไปให้ถึง</p></div></div>
        <div className="form-group"><label htmlFor="goalGpa">GPA เป้าหมาย (0.00–4.00)</label><div className="input-icon-wrap"><Target size={19}/><input id="goalGpa" type="number" min="0" max="4" step="0.01" inputMode="decimal" value={goal} onChange={e=>setGoal(e.target.value)} placeholder="เช่น 3.50"/></div></div>
        <div className="two-cols">
          <div className="form-group"><label htmlFor="targetYear">ปีการศึกษาที่ต้องการ</label><select id="targetYear" value={year} onChange={e=>{ const chosenYear=Number(e.target.value); setYear(e.target.value); setSemester(termOrder(chosenYear,1)>boundary?'1':'2'); setCalculated(false); }}>{Array.from({length:6},(_,i)=>i+1).map(y=><option key={y} value={y} disabled={termOrder(y,2)<=boundary}>ปีที่ {y}</option>)}</select></div>
          <div className="form-group"><label htmlFor="targetSemester">เทอมเป้าหมาย</label><select id="targetSemester" value={semester} onChange={e=>{setSemester(e.target.value);setCalculated(false);}}><option value="1" disabled={termOrder(year,1)<=boundary}>เทอม 1</option><option value="2" disabled={termOrder(year,2)<=boundary}>เทอม 2</option></select></div>
        </div>
        <div className="form-group slider-group"><div className="label-with-value"><label htmlFor="avgCredits">หน่วยกิตประมาณการต่อเทอม</label><strong>{credits} หน่วยกิต</strong></div><input id="avgCredits" type="range" min="18" max="25" step="1" value={credits} onChange={e=>setCredits(e.target.value)}/><div className="slider-endpoints"><span>18 หน่วยกิต</span><span>25 หน่วยกิต</span></div><p className="muted-help">ใช้หน่วยกิตของรายวิชาที่วางแผนไว้ก่อน หากไม่มีจึงใช้ค่าประมาณนี้ และจำกัดรวมไม่เกิน 129 หน่วยกิต</p></div>
        {!validChosen && <p className="form-warning"><CircleAlert size={16}/>เทอมที่เลือกเป็นเทอมปัจจุบันหรือเทอมที่ผ่านมาแล้ว โปรดเลือกเทอมในอนาคต</p>}
        <button className="btn btn-gradient btn-full" disabled={!validChosen} onClick={() => setCalculated(true)}><Calculator size={20}/>คำนวณความเป็นไปได้</button>
      </section>

    </div>
    {result && <section className="forecast-section" aria-live="polite">
      {result.error ? <div className="white-panel result-error"><CircleAlert size={23}/>{result.error}</div> :
        <div className="forecast-card">
          <div className="eyebrow forecast-eyebrow">YOUR GPA FORECAST</div>
          <h2>เป้าหมายเกรดเฉลี่ยของคุณ</h2>
          <p className="forecast-period">ภายในปีที่ {year} · เทอม {semester}</p>
          <div className="forecast-main">
            <div className="forecast-journey">
              <div className="forecast-point"><span>GPA ปัจจุบัน</span><strong>{gradeFormat(result.currentGpa)}</strong></div>
              <div className="forecast-arrow" aria-hidden="true">→</div>
              <div className="forecast-point forecast-target"><span>GPA เป้าหมาย</span><strong>{Number(goal).toFixed(2)}</strong></div>
            </div>
            <div className="forecast-primary">
              <span>{result.alreadySatisfied ? 'เกรดเฉลี่ยเป้าหมาย ณ ตอนนี้' : 'ต้องทำ GPA เฉลี่ยในหน่วยกิตที่เหลือ'}</span>
              <strong className={!result.possible ? 'unreachable' : ''}>{result.alreadySatisfied ? 'ถึงเป้าหมายแล้ว*' : `${result.requiredGpa.toFixed(2)} / 4.00`}</strong>
              <small>{numberFormat(result.remainingCredits)} หน่วยกิตที่ยังต้องได้เกรด</small>
            </div>
          </div>
          <div className={'forecast-feasibility ' + (result.possible ? 'is-possible' : 'is-impossible')}>
            {result.possible ? <CheckCircle2 size={20}/> : <XCircle size={20}/>}
            <strong>{result.possible ? 'เป้าหมายนี้ยังเป็นไปได้' : 'เป้าหมายนี้ยังไปไม่ถึงภายในเทอมที่เลือก'}</strong>
          </div>
          <div className="forecast-details">
            <div><span>หน่วยกิตที่ได้เกรดแล้ว</span><strong>{numberFormat(result.completedCredits)}</strong></div>
            <div><span>หน่วยกิตที่เหลือถึงเป้าหมาย</span><strong>{numberFormat(result.remainingCredits)}</strong></div>
            <div><span>GPA สะสมสูงสุดที่เป็นไปได้</span><strong>{result.maximumGpa.toFixed(2)}</strong></div>
          </div>
          <p className="forecast-footnote">{result.alreadySatisfied ? '*หากเกรดที่เหลือต่ำ GPA สะสมอาจลดลง' : result.possible ? 'ผลคำนวณเป็นการประมาณจากหน่วยกิตที่ลงทะเบียนและแผนรายเทอม ไม่ใช่การรับประกันผลการเรียน' : 'แม้ได้ A ทุกหน่วยกิตที่เหลือ ก็ยังไม่ถึงเป้าหมายภายในเทอมที่เลือก'}</p>
          <div className="forecast-schedule"><h3>ประมาณการหน่วยกิตรายเทอม</h3><div className="schedule-chips">{result.pendingCurrentCredits > 0 && <span className="schedule-chip">วิชาปัจจุบันที่รอเกรด {numberFormat(result.pendingCurrentCredits)} นก.</span>}{result.schedule.map((s,i)=><span className="schedule-chip" key={i}>ปี {s.year} เทอม {s.term}: {numberFormat(s.credits)} นก. {s.fromPlan?'(ตามแผน)':''}</span>)}</div></div>
        </div>}
    </section>}
    <section className="white-panel scratch-calculator" aria-labelledby="sandbox-title">
      <div className="sandbox-heading">
        <div><div className="eyebrow">COURSE GPA CALCULATOR</div><h2 id="sandbox-title">ทดลองคำนวณ GPA รายวิชา</h2><p>ใส่ชื่อวิชา หน่วยกิต และคะแนนเต็ม 100 เพื่อคำนวณเกรดเฉลี่ยถ่วงน้ำหนัก</p></div>
        <span className="sandbox-icon" aria-hidden="true"><Calculator size={25}/></span>
      </div>
      <div className="sandbox-separation-note"><Info size={17}/><span>พื้นที่ทดลองแยกจาก Courses และ Dashboard โดยสิ้นเชิง ไม่เปลี่ยน GPA จริงและไม่ถูกนำไปคำนวณเป้าหมายด้านบน</span></div>
      <div className="sandbox-table-head" aria-hidden="true"><span>ชื่อรายวิชา</span><span>หน่วยกิต</span><span>คะแนน / 100</span><span>เกรด</span><span></span></div>
      <div className="sandbox-rows">
        {draftRows.map((row, index) => {
          const detail = draftGrades.get(row.id);
          return <div className="sandbox-row" key={row.id}>
            <div className="sandbox-field sandbox-name"><label htmlFor={`scratch-name-${row.id}`}>ชื่อรายวิชา</label><input id={`scratch-name-${row.id}`} type="text" maxLength="150" value={row.name} placeholder={`วิชาที่ ${index + 1} เช่น Calculus`} onChange={e=>onChangeDraft(row.id,'name',e.target.value)}/></div>
            <div className="sandbox-field sandbox-credits"><label htmlFor={`scratch-credits-${row.id}`}>หน่วยกิต</label><input id={`scratch-credits-${row.id}`} type="number" min="0.5" max="30" step="0.5" inputMode="decimal" value={row.credits} placeholder="3" onChange={e=>onChangeDraft(row.id,'credits',e.target.value)}/></div>
            <div className="sandbox-field sandbox-score"><label htmlFor={`scratch-score-${row.id}`}>คะแนน / 100</label><input id={`scratch-score-${row.id}`} type="number" min="0" max="100" step="0.01" inputMode="decimal" value={row.score} placeholder="85" onChange={e=>onChangeDraft(row.id,'score',e.target.value)}/></div>
            <div className="sandbox-grade"><span className="sandbox-grade-label">เกรด</span>{detail?.complete ? <span className={'grade-chip ' + (detail.letter === 'F' ? 'grade-f' : '')}>{detail.letter}</span> : <span className="sandbox-pending">—</span>}</div>
            <button type="button" className="sandbox-remove" title={`ลบวิชาที่ ${index+1}`} aria-label={`ลบวิชาที่ ${index+1}`} onClick={()=>onRemoveDraftRow(row.id)}><Trash2 size={17}/></button>
          </div>;
        })}
      </div>
      <button type="button" className="btn btn-outline sandbox-add" onClick={onAddDraftRow}><Plus size={18}/>เพิ่มวิชา</button>
      <div className="sandbox-result" aria-live="polite">
        <div><span className="sandbox-result-title">GPA จากวิชาที่กรอกครบ</span><strong>{gradeFormat(draftResult.gpa)}<small> / 4.00</small></strong></div>
        <div className="sandbox-result-meta"><span>คำนวณแล้ว {draftResult.included} วิชา</span><span>{numberFormat(draftResult.totalCredits)} หน่วยกิต</span></div>
      </div>
      <p className="sandbox-hint">ใช้เกณฑ์มาตรฐาน Gradeculator: A ตั้งแต่ 80, B+ 75, B 70, C+ 65, C 60, D+ 55, D 50, F ต่ำกว่า 50 คะแนน · แถวที่กรอกไม่ครบหรือคะแนนไม่อยู่ในช่วง 0–100 จะไม่ถูกคิด GPA</p>
      <div className="sandbox-bottom-actions"><span><ShieldCheck size={16}/>บันทึกอัตโนมัติ {data.calculatorDraft ? '· ข้อมูลจะอยู่จนกว่าจะล้าง' : '· เริ่มกรอกเพื่อบันทึก'}</span><button className="btn btn-outline sandbox-clear" type="button" onClick={onClearDraft}><Trash2 size={16}/>ล้างข้อมูล</button></div>
    </section>
  </main>;
}

function Modal({ title, subtitle, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => { const onKey = e => { if(e.key === 'Escape') onClose(); }; document.addEventListener('keydown',onKey); document.body.style.overflow='hidden'; ref.current?.querySelector('input,select,button')?.focus(); return () => { document.removeEventListener('keydown',onKey); document.body.style.overflow=''; }; }, [onClose]);
  return <div className="modal-overlay" onMouseDown={e => { if(e.target===e.currentTarget) onClose(); }}><div className="modal" ref={ref} role="dialog" aria-modal="true" aria-label={title}><div className="modal-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="modal-close" title="ปิด" onClick={onClose}><X size={22}/></button></div>{children}</div></div>;
}

function DeleteConfirmation({ message, onCancel, onConfirm }) {
  return <Modal title="ยืนยันการลบข้อมูล" subtitle="ตรวจสอบรายการก่อนลบ" onClose={onCancel}>
    <div className="confirm-compact"><p>{message}</p><div className="confirm-inline-actions"><button type="button" className="btn btn-outline" onClick={onCancel}>ยกเลิก</button><button type="button" className="btn btn-danger" onClick={onConfirm}><Trash2 size={16}/>ลบข้อมูล</button></div></div>
  </Modal>;
}

function YearEditor({ existingNumbers, initial, onSave, onClose }) {
  const next = Math.max(0,...existingNumbers)+1;
  const [yearNumber,setYearNumber]=useState(String(initial?.number ?? next));
  const [error,setError]=useState('');
  const submit = e => {e.preventDefault(); const value = Number(yearNumber); if(!Number.isInteger(value)||value<1||value>12){setError('กรุณาเลือกปีที่ 1–12');return;} if(existingNumbers.includes(value) && initial?.number !== value){setError('ปีนี้มีอยู่แล้ว');return;} onSave(value);};
  return <Modal title={initial ? 'แก้ไขปีการศึกษา' : 'เพิ่มปีการศึกษา'} subtitle="จัดระเบียบโฟลเดอร์ปีและเทอม" onClose={onClose}><form className="modal-form" onSubmit={submit}><div className="form-group"><label>ปีที่</label><input type="number" min="1" max="12" value={yearNumber} onChange={e=>setYearNumber(e.target.value)} required/></div>{error && <p className="form-warning">{error}</p>}<div className="modal-actions"><button type="button" className="btn btn-outline" onClick={onClose}>ยกเลิก</button><button className="btn btn-primary" type="submit"><FolderPlus size={17}/>{initial ? 'บันทึกปี' : 'สร้างปี'}</button></div></form></Modal>;
}

function SemesterEditor({ initial, existingTerms, defaultStatus = 'planned', onSave, onClose, year }) {
  const available = [1,2].find(n=>!existingTerms.includes(n)) || 1;
  const [term,setTerm]=useState(String(initial?.number ?? available));
  const [status,setStatus]=useState(initial?.status ?? defaultStatus);
  const [error,setError]=useState('');
  const submit=e=>{e.preventDefault();if(existingTerms.includes(Number(term)) && Number(initial?.number)!==Number(term)){setError('เทอมนี้ถูกสร้างไว้แล้ว');return;} onSave({number:Number(term),status});};
  return <Modal title={initial?'แก้ไขเทอม':'เพิ่มเทอม'} subtitle={`ปีที่ ${year} · กำหนดสถานะเพื่อใช้วางแผนอนาคต`} onClose={onClose}><form className="modal-form" onSubmit={submit}><div className="form-group"><label>เลือกเทอม</label><select value={term} onChange={e=>setTerm(e.target.value)}><option value="1">เทอม 1</option><option value="2">เทอม 2</option></select></div><div className="form-group"><label>สถานะเทอม</label><select value={status} onChange={e=>setStatus(e.target.value)}><option value="completed">เรียนจบแล้ว</option><option value="current">กำลังเรียน</option><option value="planned">วางแผนไว้ (อนาคต)</option></select><p className="muted-help">ระบบ Calculator จะให้เลือกเฉพาะเทอมที่อยู่หลังเทอมที่เรียนจบหรือกำลังเรียน</p></div>{error&&<p className="form-warning">{error}</p>}<div className="modal-actions"><button className="btn btn-outline" type="button" onClick={onClose}>ยกเลิก</button><button className="btn btn-primary" type="submit"><Save size={18}/>บันทึกเทอม</button></div></form></Modal>;
}

function CourseEditor({ initial, onSave, onClose }) {
  const [name,setName]=useState(initial?.name??'');
  const [code,setCode]=useState(initial?.code??'');
  const [credits,setCredits]=useState(String(initial?.credits??3));
  const [maxScore,setMaxScore]=useState(String(initial?.maxScore??100));
  const [gradingMode,setGradingMode]=useState(initial?.gradingMode??'automatic');
  const [manualGrade,setManualGrade]=useState(initial?.manualGrade??'A');
  const [groupGrade,setGroupGrade]=useState(initial?.groupGrade??'');
  const [groupCutoffA,setGroupCutoffA]=useState(String(initial?.groupCutoffA??''));
  const [groupCutoffF,setGroupCutoffF]=useState(String(initial?.groupCutoffF??''));
  const [classMeanGpa,setClassMeanGpa]=useState(String(initial?.classMeanGpa??''));
  const [scale,setScale]=useState(clone(initial?.scale??DEFAULT_SCALE));
  const [showRules,setShowRules]=useState(false);
  const [error,setError]=useState('');
  const changeThreshold=(letter,value)=>setScale(old=>old.map(row=>row.letter===letter?{...row,min:value}:row));
  const submit=e=>{
    e.preventDefault();
    const c=Number(credits), m=Number(maxScore);
    if(!name.trim()){setError('กรุณาใส่ชื่อวิชา');return;}
    if(!Number.isFinite(c)||c<=0||c>30){setError('หน่วยกิตต้องมากกว่า 0 และไม่เกิน 30');return;}
    if(!Number.isFinite(m)||m<=0||m>10000){setError('คะแนนเต็มต้องมากกว่า 0 และไม่เกิน 10,000');return;}
    if(initial && initial.assessments.filter(a=>a.type!=='bonus').reduce((sum,a)=>sum+Number(a.maxPoints),0)>m){setError('คะแนนเต็มน้อยกว่าคะแนนเต็มของรายการที่มีอยู่ กรุณาแก้รายการคะแนนก่อน');return;}
    if(gradingMode === 'group') {
      const validScore = value => value === '' || (Number.isFinite(Number(value)) && Number(value)>=0 && Number(value)<=m);
      if(!validScore(groupCutoffA) || !validScore(groupCutoffF)) {setError('คะแนนประมาณการ A/F ต้องอยู่ระหว่าง 0 และคะแนนเต็มของวิชา');return;}
      if(groupCutoffA !== '' && groupCutoffF !== '' && Number(groupCutoffA)<=Number(groupCutoffF)){setError('คะแนนเริ่มได้ A โดยประมาณควรมากกว่าคะแนนที่คาดว่าจะได้ F');return;}
    }
    const thresholds=scale.map(row=>Number(row.min));
    if(thresholds.some(t=>!Number.isFinite(t)||t<0||t>10000) || thresholds.at(-1)!==0 || thresholds.some((t,i)=>i>0 && t>thresholds[i-1])){setError('เกณฑ์คะแนนต้องเรียงจากสูงไปต่ำ เป็นคะแนนจริงระหว่าง 0–10,000 และ F เริ่มที่ 0');return;}
    onSave({name:name.trim(),code:code.trim(),credits:c,maxScore:m,gradingMode,manualGrade,groupGrade,
      groupCutoffA,groupCutoffF,classMeanGpa,scale:scale.map((row,i)=>({...row,min:thresholds[i]}))});
  };
  return <Modal title={initial?'แก้ไขข้อมูลวิชา':'เพิ่มรายวิชาใหม่'} subtitle="ข้อมูลทั้งหมดสามารถแก้ไขได้ในภายหลัง" onClose={onClose}><form className="modal-form" onSubmit={submit}>
    <div className="form-group"><label>ชื่อรายวิชา <b>*</b></label><input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="เช่น Introduction to Computer Science" required/></div>
    <div className="form-group"><label>รหัสวิชา (ไม่บังคับ)</label><input value={code} onChange={e=>setCode(e.target.value)} placeholder="เช่น ICS101"/></div>
    <div className="two-cols"><div className="form-group"><label>หน่วยกิต <b>*</b></label><input type="number" min="0.5" max="30" step="0.5" value={credits} onChange={e=>setCredits(e.target.value)} required/></div><div className="form-group"><label>คะแนนเต็มรายวิชา <b>*</b></label><input type="number" min="1" max="10000" step="any" value={maxScore} onChange={e=>setMaxScore(e.target.value)} required/></div></div>
    <div className="form-group"><label>วิธีตัดเกรด</label><div className="mode-options"><label className={gradingMode==='automatic'?'selected':''}><input type="radio" name="grading-mode" checked={gradingMode==='automatic'} onChange={()=>setGradingMode('automatic')}/>อัตโนมัติตามคะแนน</label><label className={gradingMode==='manual'?'selected':''}><input type="radio" name="grading-mode" checked={gradingMode==='manual'} onChange={()=>setGradingMode('manual')}/>กำหนดเกรดเอง</label><label className={gradingMode==='group'?'selected':''}><input type="radio" name="grading-mode" checked={gradingMode==='group'} onChange={()=>setGradingMode('group')}/>อิงกลุ่ม (อิงเกณฑ์ห้อง)</label></div></div>
    {gradingMode==='manual' && <div className="form-group"><label>เกรดที่กำหนด</label><select value={manualGrade} onChange={e=>setManualGrade(e.target.value)}>{GRADE_LETTERS.map(letter=><option key={letter} value={letter}>{letter}</option>)}</select><p className="muted-help">ใช้เกรดที่เลือกคำนวณ GPA ทันที โดยไม่ต้องกรอกคะแนนย่อยให้ครบ</p></div>}
    {gradingMode==='group' && <div className="group-mode-editor">
      <div className="form-group"><label>เกรดที่กำหนด</label><select value={groupGrade} onChange={e=>setGroupGrade(e.target.value)}><option value="">ยังไม่ประกาศผล (รอเกรด)</option>{GRADE_LETTERS.map(letter=><option key={letter} value={letter}>{letter}</option>)}</select><p className="muted-help">เมื่อยังไม่มีเกรดประกาศ ระบบจะไม่เอาวิชานี้ไปคิด GPA แม้กรอกคะแนนย่อยครบแล้ว</p></div>
      <div className="two-cols"><div className="form-group"><label>คาดว่าเริ่มได้ A (คะแนน)</label><input type="number" min="0" max={maxScore} step="any" placeholder="เช่น 80" value={groupCutoffA} onChange={e=>setGroupCutoffA(e.target.value)}/></div><div className="form-group"><label>คาดว่าเกณฑ์ F (คะแนน)</label><input type="number" min="0" max={maxScore} step="any" placeholder="เช่น 40" value={groupCutoffF} onChange={e=>setGroupCutoffF(e.target.value)}/></div></div>
      <p className="muted-help">เกณฑ์ A/F เป็นเพียงข้อมูลประมาณการ ไม่ใช่สูตรตัดเกรดจริง สถิติสอบกรอกเพิ่มเติมได้ที่แถว Midterm และ Final ของรายวิชา</p>
    </div>}
    {gradingMode==='automatic' && <div className="grading-settings"><button type="button" className="rule-toggle" onClick={()=>setShowRules(x=>!x)}><span><Layers3 size={19}/>ปรับเกณฑ์ตัดเกรด (รายวิชา)</span>{showRules?<ChevronDown size={18}/>:<ChevronRight size={18}/>}</button>{showRules&&<div className="rule-edit-grid">{scale.map(row=><label key={row.letter}><span className={'grade-chip '+(row.letter==='F'?'grade-f':'')}>{row.letter}</span><span>คะแนนขั้นต่ำ (คะแนน)</span><input type="number" min="0" max="10000" step="0.01" disabled={row.letter==='F'} value={row.min} onChange={e=>changeThreshold(row.letter,e.target.value)}/></label>)}<button type="button" className="text-link reset-rule" onClick={()=>setScale(clone(DEFAULT_SCALE))}>ใช้เกณฑ์เริ่มต้น</button></div>}</div>}
    {error&&<p className="form-warning"><CircleAlert size={16}/>{error}</p>}
    <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={onClose}>ยกเลิก</button><button type="submit" className="btn btn-gradient"><Save size={18}/>บันทึกรายวิชา</button></div>
  </form></Modal>;
}

function AssessmentEditor({ initial, course, prefillLabel = '', onSave, onClose }) {
  const [label,setLabel]=useState(initial?.label ?? prefillLabel);
  const [maxPoints,setMaxPoints]=useState(String(initial?.maxPoints??''));
  const [error,setError]=useState('');
  const submit=e=>{e.preventDefault();const max=Number(maxPoints);if(!label.trim()){setError('กรุณาใส่คำอธิบาย');return;}if(!Number.isFinite(max)||max<=0||max>Number(course.maxScore)){setError('คะแนนเต็มต้องมากกว่า 0 และไม่เกินคะแนนเต็มวิชา');return;}const others=course.assessments.filter(a=>a.type!=='bonus'&&a.id!==initial?.id).reduce((s,a)=>s+Number(a.maxPoints),0);if(others+max>Number(course.maxScore)+1e-9){setError(`คะแนนเต็มที่เหลือให้จัดสรรได้ไม่เกิน ${numberFormat(Math.max(0,Number(course.maxScore)-others))} คะแนน`);return;}onSave({label:label.trim(),maxPoints:max});};
  return <Modal title={initial?'แก้ไขรายการคะแนน':'เพิ่มคะแนนเก็บ'} subtitle={`${course.name} · คะแนนเต็มวิชา ${numberFormat(course.maxScore)}`} onClose={onClose}><form className="modal-form" onSubmit={submit}><div className="form-group"><label>คำอธิบายคะแนน <b>*</b></label><input value={label} onChange={e=>setLabel(e.target.value)} placeholder="เช่น Quiz 1, Midterm, Final, Assignment" required/></div><div className="form-group"><label>คะแนนเต็มของรายการ <b>*</b></label><input type="number" step="any" min="0.01" max={course.maxScore} value={maxPoints} onChange={e=>setMaxPoints(e.target.value)} placeholder="เช่น 30" required/></div>{error&&<p className="form-warning"><CircleAlert size={16}/>{error}</p>}<div className="modal-actions"><button type="button" className="btn btn-outline" onClick={onClose}>ยกเลิก</button><button type="submit" className="btn btn-primary"><Save size={18}/>บันทึกรายการ</button></div></form></Modal>;
}

export default function App() {
  const [toast, setToast] = useState('');
  const notify = React.useCallback(value => setToast(value), []);
  const { data, setData, mode, user, syncStatus, loadError, choice, conflict, enterGuest, refresh, logout, resolveChoice, resolveConflict, authenticated, retryLoad } = useAccountSync(notify);
  const [authOpen, setAuthOpen] = useState(false);
  const [recoverPassword, setRecoverPassword] = useState(false);
  const [page, setPage] = useState('dashboard');
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [modal, setModal] = useState(null);
  const [deleteRequest, setDeleteRequest] = useState(null);
  const [splash, setSplash] = useState(true);
  const fileRef = useRef(null);

  useEffect(() => { const timer=setTimeout(()=>setSplash(false),2000);return ()=>clearTimeout(timer); },[]);
  useEffect(() => { if(!toast)return; const timer=setTimeout(()=>setToast(''),4000);return ()=>clearTimeout(timer); },[toast]);
  const change = fn => setData(prev=>{const next=clone(prev); fn(next); return next;});
  const editCalculatorRow = (id, field, value) => change(d => {
    if (!['name','credits','score'].includes(field)) return;
    if (!d.calculatorDraft) d.calculatorDraft = {rows: []};
    let row = d.calculatorDraft.rows.find(row => row.id === id);
    if (!row && id === NEW_ROW_ID && d.calculatorDraft.rows.length === 0) {
      row = emptyCalculatorRow(); d.calculatorDraft.rows.push(row);
    }
    if (row) row[field] = String(value);
  });
  const addCalculatorRow = () => change(d => {
    if (!d.calculatorDraft) d.calculatorDraft = {rows: []};
    if (!d.calculatorDraft.rows.length) d.calculatorDraft.rows.push(emptyCalculatorRow());
    d.calculatorDraft.rows.push(emptyCalculatorRow(uid()));
  });
  const removeCalculatorRow = id => change(d => {
    if (!d.calculatorDraft) d.calculatorDraft = {rows: []};
    d.calculatorDraft.rows = d.calculatorDraft.rows.filter(row => row.id !== id);
  });
  const clearCalculatorDraft = () => confirmRemove('ต้องการล้างรายการทดลองคำนวณ GPA ทั้งหมดหรือไม่? ข้อมูลปี เทอม และรายวิชาจริงจะไม่ถูกลบ', d => { d.calculatorDraft = {rows: []}; });
  const toggleCourseFolder = (kind, id) => change(d => toggleFolder(d, kind, id));
  const goPage = name => {setSelectedCourse(null);setPage(name); window.scrollTo({top:0,behavior:'smooth'});};
  const selectCourse=(yearId,termId,courseId)=>{setSelectedCourse({yearId,termId,courseId});window.scrollTo(0,0);};
  const closeModal = () => setModal(null);
  useEffect(() => {
    if (!supabase) return;
    const { data: listener } = supabase.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') { setRecoverPassword(true); setAuthOpen(true); }
    });
    return () => listener?.subscription?.unsubscribe();
  }, []);
  const openModal = (type, details={}) => setModal({ type, ...details });
  const confirmRemove = (message, action) => setDeleteRequest({ message, action });
  const completeRemove = () => { if(!deleteRequest) return; change(deleteRequest.action); setDeleteRequest(null); notify('ลบข้อมูลแล้ว'); };
  const addSample=()=>{if(window.confirm('เพิ่มข้อมูลตัวอย่าง 4 วิชาเพื่อทดลองหน้าตา Gradeculator หรือไม่?')){setData(prev=>({...makeSampleData(), calculatorDraft: prev.calculatorDraft}));notify('เพิ่มข้อมูลตัวอย่างแล้ว สามารถแก้ไขหรือลบได้');}};
  // A private import into the signed-in account. Never embed a user's JSON
  // into the public app bundle, source code, or sample/test fixtures.
  const importBackup = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (mode !== 'cloud' || !user?.id) {
        notify('กรุณาเข้าสู่ระบบก่อนนำเข้าข้อมูลส่วนตัว');
        return;
      }
      if (syncStatus !== 'synced') {
        notify('กรุณารอให้สถานะขึ้น “ซิงก์แล้ว” ก่อนนำเข้าข้อมูล');
        return;
      }
      const parsed = JSON.parse(await file.text());
      if (!isValidData(parsed)) {
        notify('ไฟล์ไม่ถูกต้องหรือไม่ใช่ข้อมูลสำรอง Gradeculator');
        return;
      }
      const imported = normalizeData(parsed);
      const courseCount = imported.years.reduce((n, year) => n + year.semesters.reduce((m, term) => m + term.courses.length, 0), 0);
      if (!window.confirm(`นำข้อมูลสำรองส่วนตัว ${courseCount} วิชาเข้าสู่บัญชี ${user.email} ใช่ไหม?\n\nระบบจะรวมกับข้อมูลในบัญชี โดยเก็บข้อมูลบัญชีปัจจุบันไว้เมื่อเป็นวิชาเดียวกัน และเพิ่มรายการจากไฟล์ที่ยังไม่มี\n\nข้อมูลจะบันทึกผ่านบัญชี Supabase ของคุณเท่านั้น ไม่ใช่ข้อมูลตัวอย่างและไม่เผยแพร่ใน GitHub`)) return;
      // Cloud edits take precedence for matching stable course IDs, retaining
      // new/missing terms and assessments from the incoming private backup.
      setData(current => mergeDocuments(imported, current));
      setSelectedCourse(null);
      goPage('dashboard');
      notify('รวมข้อมูลจากไฟล์แล้ว กำลังซิงก์เข้าบัญชี · รอจนขึ้น “ซิงก์แล้ว”');
    } catch (error) {
      console.error('Private Gradeculator import failed', error);
      notify('เปิดไฟล์ JSON ไม่สำเร็จ กรุณาตรวจไฟล์สำรองแล้วลองใหม่');
    } finally {
      event.target.value = '';
    }
  };
  const selected = selectedCourse ? byId(data,selectedCourse.yearId,selectedCourse.termId,selectedCourse.courseId) : null;

  return <>
    {splash ? <Splash/> : mode === 'boot' ? <div className="account-gateway"><div className="account-loading">กำลังตรวจสอบบัญชี Gradeculator…</div></div> : mode === 'entry' ?
      <AuthPanel onGuest={enterGuest} onAuthenticated={authenticated} initial="login"/> :
      (mode === 'choose' || mode === 'recover') && choice ? <CloudChoice isRecovery={mode === 'recover'} cloudExists={Boolean(choice.remote)} onBackup={()=>downloadBackup(choice.local)} onCloud={()=>resolveChoice(false)} onGuest={()=>{ if (choice.remote && !window.confirm('การใช้ข้อมูลในเครื่องแทนบัญชีออนไลน์อาจเปลี่ยนคะแนนล่าสุด ยืนยันหรือไม่?')) return; resolveChoice(true); }} onLogout={logout}/> :
      mode === 'error' ? <div className="account-gateway"><section className="account-card decision-card"><h1>ไม่สามารถโหลดข้อมูลบัญชีได้</h1><p className="account-intro">{loadError}</p><button className="btn btn-primary decision-btn" onClick={retryLoad}>ลองเชื่อมต่อใหม่</button><button className="btn btn-outline decision-btn" onClick={logout}>กลับไปใช้ Guest</button></section></div> : <>
      <Header page={page} onPage={goPage} user={user} syncStatus={syncStatus} onLogin={()=>setAuthOpen(true)} onLogout={logout} onRefresh={refresh} onExport={()=>{downloadBackup(data);notify('ดาวน์โหลดไฟล์สำรอง JSON แล้ว');}} onImport={()=>fileRef.current?.click()}/>
      <input className="sr-only" ref={fileRef} type="file" accept="application/json,.json" onChange={importBackup}/>
      {page==='dashboard' && <Dashboard data={data} onCourses={()=>goPage('courses')} onSample={addSample}
        onToggleTermGpa={id => change(d => { for (const y of d.years) { const sem = y.semesters.find(t => t.id === id); if (sem) { sem.includeInGpa = sem.includeInGpa === false; break; } } })}/>}
      {page==='courses' && (!selectedCourse || !selected?.course ? <Courses data={data}
        onToggleYear={yearId=>toggleCourseFolder('year',yearId)}
        onToggleTerm={termId=>toggleCourseFolder('term',termId)}
        onAddYear={()=>openModal('year')}
        onEditYear={yearId=>openModal('year',{yearId})}
        onDeleteYear={yearId=>confirmRemove('ต้องการลบปีนี้ พร้อมทุกเทอมและทุกวิชาอย่างถาวร?',d=>{d.years=d.years.filter(y=>y.id!==yearId);})}
        onAddTerm={yearId=>openModal('semester',{yearId})}
        onEditTerm={(yearId,termId)=>openModal('semester',{yearId,termId})}
        onDeleteTerm={(yearId,termId)=>confirmRemove('ลบเทอมนี้และรายวิชาทั้งหมดด้านในอย่างถาวร?',d=>{const year=d.years.find(y=>y.id===yearId);year.semesters=year.semesters.filter(s=>s.id!==termId);})}
        onAddCourse={(yearId,termId)=>openModal('course',{yearId,termId})}
        onEditCourse={(yearId,termId,courseId)=>openModal('course',{yearId,termId,courseId})}
        onDeleteCourse={(yearId,termId,courseId)=>confirmRemove('ลบรายวิชานี้พร้อมคะแนนเก็บทั้งหมด?',d=>{const {semester}=byId(d,yearId,termId);semester.courses=semester.courses.filter(c=>c.id!==courseId);})}
        onSelectCourse={selectCourse} onSample={addSample}/> :
        <CourseDetail year={selected.year} semester={selected.semester} course={selected.course}
          onBack={()=>{setSelectedCourse(null);window.scrollTo(0,0);}}
          onEditCourse={()=>openModal('course',{...selectedCourse})}
          onAddAssessment={prefillLabel=>openModal('assessment',{...selectedCourse,prefillLabel})}
          onEditAssessment={assessmentId=>openModal('assessment',{...selectedCourse,assessmentId})}
          onRemoveAssessment={assessmentId=>confirmRemove('ต้องการลบรายการคะแนนเก็บนี้หรือไม่?',d=>{const {course}=byId(d,selectedCourse.yearId,selectedCourse.termId,selectedCourse.courseId);course.assessments=course.assessments.filter(a=>a.id!==assessmentId);})}
          onEditEarned={(assessmentId,value)=>change(d=>{const {course}=byId(d,selectedCourse.yearId,selectedCourse.termId,selectedCourse.courseId);const assessment=course.assessments.find(a=>a.id===assessmentId);if(value===''){assessment.earned='';return;}const n=Number(value);if(Number.isFinite(n) && n >= 0 && (assessment.type==='bonus' || n <= Number(assessment.maxPoints))) assessment.earned=value;})}
          onStatus={(assessmentId,status)=>change(d=>{const {course}=byId(d,selectedCourse.yearId,selectedCourse.termId,selectedCourse.courseId);course.assessments.find(a=>a.id===assessmentId).status=status;})}
          onReorderAssessment={(fromId,toId)=>change(d=>{const {course}=byId(d,selectedCourse.yearId,selectedCourse.termId,selectedCourse.courseId);course.assessments=reorderAssessments(course.assessments,fromId,toId);})}
          expandedExamStats={data.ui?.expandedExamStats ?? []}
          onToggleExamStats={assessmentId => change(d => toggleExamStats(d, assessmentId))}
          onEditGroupStat={(exam,field,value)=>change(d=>{if(value!=='' && (!Number.isFinite(Number(value)) || Number(value)<0 || (field==='n' && !Number.isInteger(Number(value)))))return;const {course}=byId(d,selectedCourse.yearId,selectedCourse.termId,selectedCourse.courseId);if(!course.groupStats) course.groupStats={midterm:{},final:{}};if(!course.groupStats[exam])course.groupStats[exam]={};course.groupStats[exam][field]=value;})}
          onAddBonus={()=>change(d=>{const {course}=byId(d,selectedCourse.yearId,selectedCourse.termId,selectedCourse.courseId);if(!course.assessments.some(a=>a.type==='bonus')) course.assessments.push({id:uid(),type:'bonus',label:'Bonus',breakdown:'',earned:'',status:'green'});})}
          onEditBonus={(assessmentId,field,value)=>change(d=>{const {course}=byId(d,selectedCourse.yearId,selectedCourse.termId,selectedCourse.courseId);const bonus=course.assessments.find(a=>a.id===assessmentId&&a.type==='bonus');if(bonus&&field==='breakdown') bonus.breakdown=value;})}/>)}
      {page==='destination' && <Destination data={data} onChangeDraft={editCalculatorRow} onAddDraftRow={addCalculatorRow} onRemoveDraftRow={removeCalculatorRow} onClearDraft={clearCalculatorDraft}/>}
      <footer className="footer"><span><GradeculatorMark/> Gradeculator</span><span>by wachi · {mode === 'cloud' ? 'บัญชีออนไลน์ · มีสำเนาในเครื่อง' : 'Guest · ข้อมูลเก็บในเครื่องนี้'}</span></footer>
    </>}
    {authOpen && <AuthPanel isOverlay initial={recoverPassword ? 'reset-password' : 'login'} recovery={recoverPassword} onGuest={()=>{setAuthOpen(false);setRecoverPassword(false);if(mode==='entry')enterGuest();}} onAuthenticated={account=>{ authenticated(account);setAuthOpen(false);setRecoverPassword(false); }} onClose={()=>{setAuthOpen(false);setRecoverPassword(false);}}/>}
    {conflict && <CloudConflict onBackup={()=>downloadBackup(conflict.local)} onUseCloud={()=>resolveConflict(false)} onOverwrite={()=>{if(window.confirm('การทำเช่นนี้จะแทนที่ข้อมูลออนไลน์ล่าสุดด้วยข้อมูลเครื่องนี้ ยืนยันหรือไม่?'))resolveConflict(true);}} onLogout={logout}/>}
    {deleteRequest && <DeleteConfirmation message={deleteRequest.message} onCancel={()=>setDeleteRequest(null)} onConfirm={completeRemove}/>}
    {toast&&!splash&&<div role="status" className="toast"><CheckCircle2 size={18}/>{toast}<button aria-label="ปิด" onClick={()=>setToast('')}><X size={16}/></button></div>}
    {modal?.type==='year'&&<YearEditor key={modal.yearId??'new'} initial={data.years.find(y=>y.id===modal.yearId)} existingNumbers={data.years.map(y=>y.number)} onClose={closeModal} onSave={number=>{change(d=>{const old=d.years.find(y=>y.id===modal.yearId);if(old) old.number=number;else d.years.push(createYear(number));});closeModal();notify('บันทึกปีการศึกษาแล้ว');}}/>}
    {modal?.type==='semester'&&(() => {
      const year=data.years.find(y=>y.id===modal.yearId);
      const initial=year?.semesters.find(s=>s.id===modal.termId);
      return year ? <SemesterEditor key={modal.termId??'new'} year={year.number} initial={initial} defaultStatus={data.years.some(y=>y.semesters.some(t=>t.status==='current'||t.status==='completed')) ? 'planned' : 'current'} existingTerms={year.semesters.map(s=>s.number)} onClose={closeModal}
        onSave={value=>{change(d=>{const y=d.years.find(y=>y.id===modal.yearId);if(initial){const sem=y.semesters.find(s=>s.id===modal.termId);sem.number=value.number;sem.status=value.status;}else y.semesters.push(createSemester(value.number,value.status));});closeModal();notify('บันทึกเทอมแล้ว');}}/> : null;
    })()}
    {modal?.type==='course'&&(() => {
      const {semester,course}=byId(data,modal.yearId,modal.termId,modal.courseId);
      return semester ? <CourseEditor key={modal.courseId??'new'} initial={course} onClose={closeModal}
        onSave={value=>{change(d=>{const {semester:sem,course:old}=byId(d,modal.yearId,modal.termId,modal.courseId);if(old){Object.assign(old,value);}else sem.courses.push(createCourse(value));});closeModal();notify('บันทึกรายวิชาแล้ว');}}/> : null;
    })()}
    {modal?.type==='assessment'&&(() => {
      const {course}=byId(data,modal.yearId,modal.termId,modal.courseId);
      const initial=course?.assessments.find(a=>a.id===modal.assessmentId);
      return course ? <AssessmentEditor key={modal.assessmentId??'new'} initial={initial} prefillLabel={modal.prefillLabel} course={course} onClose={closeModal}
        onSave={value=>{change(d=>{const {course:old}=byId(d,modal.yearId,modal.termId,modal.courseId);if(initial){const a=old.assessments.find(a=>a.id===modal.assessmentId);Object.assign(a,value);if(a.earned!==''&&Number(a.earned)>Number(value.maxPoints))a.earned=String(value.maxPoints);}else old.assessments.push({id:uid(),...value,earned:'',status:'green'});});closeModal();notify('บันทึกคะแนนเก็บแล้ว');}}/> : null;
    })()}
  </>;
}
