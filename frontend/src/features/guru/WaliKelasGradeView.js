// frontend/src/features/guru/WaliKelasGradeView.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
  LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import * as guruApi from '../../api/guru';
import { fetchStudentAnalytics } from '../../api/analytics';
import { ALLOWED_MAPEL_WALI, normalizeName } from '../../config/constants';
import Button from '../../components/Button';
import Table from '../../components/Table';
import ModuleContainer from '../../components/ModuleContainer';
import PageHeader from '../../components/PageHeader';
import FormSection from '../../components/FormSection';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatusMessage from '../../components/StatusMessage';
import EmptyState from '../../components/EmptyState';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

const WaliKelasGradeView = ({ activeTASemester, userId }) => {
  const [activeView, setActiveView] = useState('overview');
  const [gradesData, setGradesData] = useState(null);
  const [classInfo, setClassInfo] = useState(null);
  const [classList, setClassList] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentHistory, setStudentHistory] = useState(null);
  const [processedData, setProcessedData] = useState({
    gradesPerSubjectTable: new Map(),
    summaryTableData: [],
    uniqueTipeNilaiPerMapel: new Map(),
    gradesByStudentChart: [],
    gradesBySubjectChart: [],
    gradeDistributionChart: [],
  });
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });

  const fetchWaliKelasClassList = useCallback(async () => {
    try {
      if (!userId || !activeTASemester) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const classes = await guruApi.getWaliKelasClassList(userId, activeTASemester.id_ta_semester);
      setClassList(classes);
      setLoading(false);
      
      if (classes.length === 0) {
        // Guru bukan wali kelas - langsung stop loading
        return;
      }
      
      if (classes.length > 0 && !selectedClass) {
        setSelectedClass(classes[0].id_kelas);
      }
    } catch (err) {
      console.error('Error fetching wali kelas class list:', err);
      setError('Gagal memuat data wali kelas. Silakan coba lagi.');
      setClassList([]);
      setLoading(false);
    }
  }, [userId, activeTASemester, selectedClass]);

  const fetchWaliKelasGrades = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!userId || !activeTASemester) {
        setError("Informasi guru atau tahun ajaran aktif tidak tersedia.");
        setLoading(false);
        return;
      }
      const response = await guruApi.getWaliKelasGrades(userId, activeTASemester.id_ta_semester, selectedClass);
      setGradesData(response.grades);
      setClassInfo(response.classInfo);
      processGradeData(response.grades);
    } catch (err) {
      setError(err.message);
      setGradesData([]);
      setClassInfo(null);
      setProcessedData({
        gradesPerSubjectTable: new Map(),
        summaryTableData: [],
        uniqueTipeNilaiPerMapel: new Map(),
        gradesByStudentChart: [],
        gradesBySubjectChart: [],
        gradeDistributionChart: [],
      });
    } finally {
      setLoading(false);
    }
  }, [activeTASemester, userId, selectedClass]);

  const fetchStudentHistory = useCallback(async (studentId) => {
    try {
      const result = await fetchStudentAnalytics(studentId, {});
      setStudentHistory(result);
    } catch (err) {
      console.error('Error fetching student history:', err);
      setStudentHistory(null);
    }
  }, []);

  const handleStudentClick = (student) => {
    setSelectedStudent(student);
    setActiveView('studentDetail');
    fetchStudentHistory(student.id_siswa);
  };

  useEffect(() => {
    fetchWaliKelasClassList();
  }, [fetchWaliKelasClassList]);

  useEffect(() => {
    if (selectedClass) {
      fetchWaliKelasGrades();
    }
  }, [fetchWaliKelasGrades, selectedClass]);

  const processGradeData = (grades) => {
    const gradesPerSubjectTable = new Map();
    const summaryStudentMap = new Map();
    const subjectChartMap = new Map();
    const uniqueTipeNilaiPerMapel = new Map();

    grades.forEach(grade => {
      if (!summaryStudentMap.has(grade.id_siswa)) {
        summaryStudentMap.set(grade.id_siswa, {
          id_siswa: grade.id_siswa,
          nama_siswa: grade.nama_siswa,
          overall_total: 0,
          overall_count: 0,
          subject_totals: new Map(),
        });
      }
      
      if (!grade.nama_mapel || !grade.jenis_nilai || grade.nilai === null) {
        return;
      }

      if (!gradesPerSubjectTable.has(grade.nama_mapel)) {
        gradesPerSubjectTable.set(grade.nama_mapel, new Map());
      }
      const studentsInSubjectMap = gradesPerSubjectTable.get(grade.nama_mapel);

      if (!studentsInSubjectMap.has(grade.id_siswa)) {
        studentsInSubjectMap.set(grade.id_siswa, {
          id_siswa: grade.id_siswa,
          nama_siswa: grade.nama_siswa,
          total_mapel_nilai: 0,
          count_mapel_nilai: 0,
        });
      }
      const studentSubjectData = studentsInSubjectMap.get(grade.id_siswa);
      
      const displayKey = grade.jenis_nilai === 'TP' && grade.urutan_tp 
        ? `${grade.jenis_nilai} ${grade.urutan_tp}` 
        : grade.jenis_nilai;
      
      studentSubjectData[displayKey] = grade.nilai;
      studentSubjectData.total_mapel_nilai += grade.nilai;
      studentSubjectData.count_mapel_nilai++;

      if (!uniqueTipeNilaiPerMapel.has(grade.nama_mapel)) {
        uniqueTipeNilaiPerMapel.set(grade.nama_mapel, new Set());
      }
      uniqueTipeNilaiPerMapel.get(grade.nama_mapel).add(displayKey);

      const studentSummary = summaryStudentMap.get(grade.id_siswa);
      studentSummary.overall_total += grade.nilai;
      studentSummary.overall_count++;

      if (!studentSummary.subject_totals.has(grade.nama_mapel)) {
        studentSummary.subject_totals.set(grade.nama_mapel, { total: 0, count: 0 });
      }
      const subjectTotal = studentSummary.subject_totals.get(grade.nama_mapel);
      subjectTotal.total += grade.nilai;
      subjectTotal.count++;

      if (!subjectChartMap.has(grade.nama_mapel)) {
        subjectChartMap.set(grade.nama_mapel, { total_nilai: 0, count: 0 });
      }
      const subjectChart = subjectChartMap.get(grade.nama_mapel);
      subjectChart.total_nilai += grade.nilai;
      subjectChart.count++;
    });

    const finalGradesPerSubjectTable = new Map();
    gradesPerSubjectTable.forEach((studentsMap, nama_mapel) => {
      const studentList = Array.from(studentsMap.values()).map(student => ({
        ...student,
        rata_rata_mapel: student.count_mapel_nilai > 0 ? parseFloat((student.total_mapel_nilai / student.count_mapel_nilai).toFixed(2)) : 0,
      })).sort((a, b) => a.nama_siswa.localeCompare(b.nama_siswa));
      finalGradesPerSubjectTable.set(nama_mapel, studentList);
    });

    const summaryTableData = Array.from(summaryStudentMap.values()).map(student => {
      const studentSummaryObj = {
        id_siswa: student.id_siswa,
        nama_siswa: student.nama_siswa,
        overall_final_average: student.overall_count > 0 ? parseFloat((student.overall_total / student.overall_count).toFixed(2)) : 0,
      };
      student.subject_totals.forEach((data, nama_mapel) => {
        studentSummaryObj[`${nama_mapel}_RataRata`] = data.count > 0 ? parseFloat((data.total / data.count).toFixed(2)) : null;
      });
      return studentSummaryObj;
    }).sort((a, b) => a.nama_siswa.localeCompare(b.nama_siswa));

    const gradeDistributionCounts = { 'A (90-100)': 0, 'B (80-89)': 0, 'C (70-79)': 0, 'D (60-69)': 0, 'E (<60)': 0 };
    summaryTableData.forEach(student => {
      const average = student.overall_final_average;
      if (average >= 90) gradeDistributionCounts['A (90-100)']++;
      else if (average >= 80) gradeDistributionCounts['B (80-89)']++;
      else if (average >= 70) gradeDistributionCounts['C (70-79)']++;
      else if (average >= 60) gradeDistributionCounts['D (60-69)']++;
      else gradeDistributionCounts['E (<60)']++;
    });
    const totalStudentsForDistribution = Object.values(gradeDistributionCounts).reduce((sum, count) => sum + count, 0);
    const gradeDistributionChart = Object.entries(gradeDistributionCounts).map(([range, count]) => ({
      name: range,
      value: count,
      percentage: totalStudentsForDistribution > 0 ? parseFloat(((count / totalStudentsForDistribution) * 100).toFixed(2)) : 0,
    }));

    const gradesByStudentChart = Array.from(summaryStudentMap.values()).map(student => ({
      nama_siswa: student.nama_siswa,
      rata_rata: student.overall_count > 0 ? parseFloat((student.overall_total / student.overall_count).toFixed(2)) : 0,
    })).sort((a, b) => a.nama_siswa.localeCompare(b.nama_siswa));

    let gradesBySubjectChart = Array.from(subjectChartMap.entries()).map(([name, data]) => ({
      nama_mapel: name,
      rata_rata: data.count > 0 ? parseFloat((data.total_nilai / data.count).toFixed(2)) : 0,
    })).sort((a, b) => a.nama_mapel.localeCompare(b.nama_mapel));

    // Wali kelas bisa lihat semua mata pelajaran yang diajar di kelasnya
    const filteredGradesPerSubjectTable = finalGradesPerSubjectTable;
    const filteredUniqueTipeNilaiPerMapel = uniqueTipeNilaiPerMapel;

    setProcessedData({
      gradesPerSubjectTable: filteredGradesPerSubjectTable,
      summaryTableData,
      uniqueTipeNilaiPerMapel: filteredUniqueTipeNilaiPerMapel,
      gradesByStudentChart,
      gradesBySubjectChart,
      gradeDistributionChart,
    });
  };

  const sortedSummaryData = useMemo(() => {
    let sortableItems = [...processedData.summaryTableData];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        if (typeof aValue === 'string') {
          return sortConfig.direction === 'ascending' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        } else {
          aValue = aValue === null ? -Infinity : aValue;
          bValue = bValue === null ? -Infinity : bValue;

          if (aValue < bValue) {
            return sortConfig.direction === 'ascending' ? -1 : 1;
          }
          if (aValue > bValue) {
            return sortConfig.direction === 'ascending' ? 1 : -1;
          }
          return 0;
        }
      });
    }
    return sortableItems;
  }, [processedData.summaryTableData, sortConfig]);

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    } else if (sortConfig.key === key && sortConfig.direction === 'descending') {
      direction = 'none';
      key = null;
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key === key) {
      if (sortConfig.direction === 'ascending') return ' ▲';
      if (sortConfig.direction === 'descending') return ' ▼';
    }
    return '';
  };

  if (loading) return <LoadingSpinner message="Memuat dashboard wali kelas..." />;
  if (error) return <StatusMessage type="error" message={error} />;
  if (classList.length === 0) return <StatusMessage type="info" message="Anda bukan wali kelas untuk tahun ajaran dan semester aktif ini." />;
  if (!classInfo) return <StatusMessage type="info" message="Silakan pilih kelas atau tunggu data dimuat." />;

  const allSubjectNames = Array.from(processedData.gradesPerSubjectTable.keys()).sort();

  // Prepare student history chart data so each period contains values for all mapel (fill missing with null)
  const studentHistoryMapels = studentHistory && studentHistory.data ? Array.from(new Set(studentHistory.data.map(d => d.nama_mapel))) : [];
  const studentHistoryChartData = studentHistory && studentHistory.data ? (() => {
    const grouped = {};
    studentHistory.data.forEach(item => {
      const periodStr = `${item.tahun_ajaran} ${item.semester}`;
      if (!grouped[periodStr]) grouped[periodStr] = { period: periodStr };
      grouped[periodStr][item.nama_mapel] = parseFloat(item.rata_keseluruhan || 0);
    });
    return Object.keys(grouped).sort().map(period => {
      const obj = grouped[period];
      studentHistoryMapels.forEach(m => { if (!(m in obj)) obj[m] = null; });
      return obj;
    });
  })() : [];

  // Radar chart data: current semester averages for selected student
  const radarData = selectedStudent ? allSubjectNames.map(subject => ({
    subject,
    value: selectedStudent[`${subject}_RataRata`] !== null && selectedStudent[`${subject}_RataRata`] !== undefined ? selectedStudent[`${subject}_RataRata`] : 0,
  })) : [];

  const totalStudents = processedData.summaryTableData.length; 
  const avgClassGrade = totalStudents > 0 
    ? (processedData.summaryTableData.reduce((sum, s) => sum + s.overall_final_average, 0) / totalStudents).toFixed(2)
    : 0;
  const studentsAbove75 = processedData.summaryTableData.filter(s => s.overall_final_average >= 75).length;
  const studentsBelow60 = processedData.summaryTableData.filter(s => s.overall_final_average < 60).length;

  return (
    <ModuleContainer>
      <PageHeader
        icon="chart-line"
        title={`Dashboard Wali Kelas: ${classInfo.nama_kelas}`}
        subtitle={`Tahun Ajaran ${activeTASemester.tahun_ajaran} - Semester ${activeTASemester.semester}`}
      />

      {classList.length > 1 && (
        <FormSection title="Pilih Kelas">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kelas yang Anda Wali
              </label>
              <select
                value={selectedClass || ''}
                onChange={(e) => setSelectedClass(parseInt(e.target.value))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors bg-white"
              >
                {classList.map((kelas) => (
                  <option key={kelas.id_kelas} value={kelas.id_kelas}>
                    {kelas.nama_kelas} ({kelas.jumlah_siswa} siswa)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </FormSection>
      )}

      <div className="mb-6 border-b border-gray-200">
        <div className="flex flex-wrap gap-2 sm:gap-4">
          <Button
            variant={activeView === 'overview' ? 'primary' : 'ghost'}
            icon="chart-pie"
            onClick={() => setActiveView('overview')}
          >
            Overview
          </Button>
          <Button
            variant={activeView === 'students' ? 'primary' : 'ghost'}
            icon="users"
            onClick={() => setActiveView('students')}
          >
            Daftar Siswa ({totalStudents})
          </Button>
          <Button
            variant={activeView === 'grades' ? 'primary' : 'ghost'}
            icon="clipboard-list"
            onClick={() => setActiveView('grades')}
          >
            Nilai Detail
          </Button>
        </div>
      </div>

      {activeView === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg shadow-sm">
              <p className="text-sm text-gray-600 mb-1">Total Siswa</p>
              <p className="text-3xl font-bold text-blue-600">{totalStudents}</p>
            </div>
            <div className="p-6 bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg shadow-sm">
              <p className="text-sm text-gray-600 mb-1">Rata-rata Kelas</p>
              <p className="text-3xl font-bold text-green-600">{avgClassGrade}</p>
            </div>
            <div className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg shadow-sm">
              <p className="text-sm text-gray-600 mb-1">Nilai ≥ 75</p>
              <p className="text-3xl font-bold text-purple-600">{studentsAbove75}</p>
              <p className="text-xs text-gray-500">{totalStudents > 0 ? ((studentsAbove75/totalStudents)*100).toFixed(0) : 0}% siswa</p>
            </div>
            <div className="p-6 bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-lg shadow-sm">
              <p className="text-sm text-gray-600 mb-1">Perlu Perhatian</p>
              <p className="text-3xl font-bold text-red-600">{studentsBelow60}</p>
              <p className="text-xs text-gray-500">Nilai {'<'} 60</p>
            </div>
          </div>

          {studentsBelow60 > 0 && (
            <div className="p-6 bg-yellow-50 border border-yellow-300 rounded-lg">
              <h3 className="text-lg font-semibold text-yellow-800 mb-4 flex items-center">
                <i className="fas fa-exclamation-triangle mr-2"></i>
                Siswa yang Perlu Perhatian Khusus
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border rounded">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 border text-left">Nama Siswa</th>
                      <th className="px-4 py-2 border text-center">Rata-rata</th>
                      <th className="px-4 py-2 border text-center">Status</th>
                      <th className="px-4 py-2 border text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processedData.summaryTableData
                      .filter(s => s.overall_final_average < 60)
                      .sort((a, b) => a.overall_final_average - b.overall_final_average)
                      .map(student => (
                        <tr key={student.id_siswa} className="hover:bg-gray-50">
                          <td className="px-4 py-2 border">{student.nama_siswa}</td>
                          <td className="px-4 py-2 border text-center">
                            <span className="px-2 py-1 bg-red-100 text-red-800 rounded font-semibold">
                              {student.overall_final_average}
                            </span>
                          </td>
                          <td className="px-4 py-2 border text-center">
                            <span className="px-2 py-1 bg-red-500 text-white rounded text-xs">
                              Kritis
                            </span>
                          </td>
                          <td className="px-4 py-2 border text-center">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleStudentClick(student)}
                            >
                              Lihat Detail
                            </Button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="p-6 bg-green-50 border border-green-300 rounded-lg">
            <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center">
              <i className="fas fa-trophy mr-2"></i>
              Top 5 Siswa Berprestasi
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {processedData.summaryTableData
                .sort((a, b) => b.overall_final_average - a.overall_final_average)
                .slice(0, 5)
                .map((student, idx) => (
                  <div key={student.id_siswa} className="p-3 bg-white border border-green-200 rounded text-center">
                    <div className="text-2xl mb-1">
                      {idx === 0 && '🥇'}
                      {idx === 1 && '🥈'}
                      {idx === 2 && '🥉'}
                      {idx > 2 && `#${idx + 1}`}
                    </div>
                    <p className="text-sm font-medium text-gray-700 truncate">{student.nama_siswa}</p>
                    <p className="text-lg font-bold text-green-600">{student.overall_final_average}</p>
                  </div>
                ))}
            </div>
          </div>

          {/* Grafik Section - Stacked Vertically */}
          <div className="space-y-6">
            <div className="p-4 border rounded-lg bg-white shadow">
              <h4 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
                <i className="fas fa-chart-bar mr-2 text-indigo-600"></i>
                Rata-rata per Mata Pelajaran
              </h4>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={processedData.gradesBySubjectChart}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 250, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis dataKey="nama_mapel" type="category" width={240} />
                  <Tooltip />
                  <Bar dataKey="rata_rata" fill="#00C49F" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="p-4 border rounded-lg bg-white shadow">
              <h4 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
                <i className="fas fa-chart-pie mr-2 text-indigo-600"></i>
                Distribusi Nilai Kelas
              </h4>
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={processedData.gradeDistributionChart}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {processedData.gradeDistributionChart.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value} siswa`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {activeView === 'students' && (
        <div>
          <div className="mb-4 flex justify-between items-center">
            <h3 className="text-xl font-semibold text-gray-800">
              Daftar Siswa Kelas {classInfo.nama_kelas}
            </h3>
            <div className="text-sm text-gray-600">
              Total: {totalStudents} siswa
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border rounded-lg">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 border text-left">No</th>
                  <th className="px-4 py-3 border text-left">ID Siswa</th>
                  <th className="px-4 py-3 border text-left">Nama Siswa</th>
                  <th className="px-4 py-3 border text-center">Rata-rata</th>
                  <th className="px-4 py-3 border text-center">Status</th>
                  <th className="px-4 py-3 border text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {sortedSummaryData.map((student, idx) => {
                  const status = student.overall_final_average >= 75 ? 'Baik' : 
                                 student.overall_final_average >= 60 ? 'Cukup' : 'Perlu Perhatian';
                  const statusColor = student.overall_final_average >= 75 ? 'bg-green-100 text-green-800' : 
                                      student.overall_final_average >= 60 ? 'bg-yellow-100 text-yellow-800' : 
                                      'bg-red-100 text-red-800';
                  
                  return (
                    <tr key={student.id_siswa} className="hover:bg-gray-50">
                      <td className="px-4 py-3 border">{idx + 1}</td>
                      <td className="px-4 py-3 border">{student.id_siswa}</td>
                      <td className="px-4 py-3 border font-medium">{student.nama_siswa}</td>
                      <td className="px-4 py-3 border text-center">
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-semibold">
                          {student.overall_final_average}
                        </span>
                      </td>
                      <td className="px-4 py-3 border text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-3 border text-center">
                        <Button
                          variant="primary"
                          size="sm"
                          icon="chart-line"
                          onClick={() => handleStudentClick(student)}
                        >
                          Lihat Histori
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeView === 'grades' && !gradesData ? (
        <EmptyState
          icon="clipboard-list"
          title="Belum Ada Nilai"
          message={`Belum ada nilai yang diinput untuk kelas ${classInfo.nama_kelas} di semester ini.`}
        />
      ) : activeView === 'grades' && (
        <div className="space-y-8">
          {Array.from(processedData.gradesPerSubjectTable.entries()).map(([nama_mapel, studentsGradeList]) => {
            const uniqueTipeNilai = Array.from(processedData.uniqueTipeNilaiPerMapel.get(nama_mapel) || []).sort();

            return (
              <div key={nama_mapel} className="border rounded-lg p-4 bg-gray-50">
                <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <i className="fas fa-book mr-2 text-indigo-600"></i>
                  Detail Nilai {nama_mapel}
                </h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white border">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 border text-left">Nama Siswa</th>
                        {uniqueTipeNilai.map(tipe => (
                          <th key={tipe} className="px-4 py-2 border text-center">{tipe}</th>
                        ))}
                        <th className="px-4 py-2 border text-center">Rata-rata {nama_mapel}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentsGradeList.map(student => (
                        <tr key={student.id_siswa} className="hover:bg-gray-50">
                          <td className="px-4 py-2 border font-medium">{student.nama_siswa}</td>
                          {uniqueTipeNilai.map(tipe => (
                            <td key={`${student.id_siswa}-${tipe}`} className="px-4 py-2 border text-center">
                              {student[tipe] !== undefined ? student[tipe] : '-'}
                            </td>
                          ))}
                          <td className="px-4 py-2 border text-center">
                            <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full font-semibold">
                              {student.rata_rata_mapel}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <i className="fas fa-table mr-2 text-indigo-600"></i>
              Ringkasan Nilai Siswa Keseluruhan
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border">
                <thead className="bg-gray-100">
                  <tr>
                    <th
                      className="px-4 py-3 border text-left cursor-pointer hover:bg-gray-200"
                      onClick={() => requestSort('nama_siswa')}
                    >
                      Nama Siswa {getSortIndicator('nama_siswa')}
                    </th>
                    {allSubjectNames.map(subject => (
                      <th
                        key={subject}
                        className="px-4 py-3 border text-center cursor-pointer hover:bg-gray-200"
                        onClick={() => requestSort(`${subject}_RataRata`)}
                      >
                        {subject} {getSortIndicator(`${subject}_RataRata`)}
                      </th>
                    ))}
                    <th
                      className="px-4 py-3 border text-center cursor-pointer hover:bg-gray-200"
                      onClick={() => requestSort('overall_final_average')}
                    >
                      Rata-rata Akhir {getSortIndicator('overall_final_average')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSummaryData.map(student => (
                    <tr key={student.id_siswa} className="hover:bg-gray-50">
                      <td className="px-4 py-3 border font-medium">{student.nama_siswa}</td>
                      {allSubjectNames.map(subject => (
                        <td key={`${student.id_siswa}-${subject}_RataRata`} className="px-4 py-3 border text-center">
                          {student[`${subject}_RataRata`] !== null ? student[`${subject}_RataRata`] : '-'}
                        </td>
                      ))}
                      <td className="px-4 py-3 border text-center">
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-bold">
                          {student.overall_final_average}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeView === 'studentDetail' && selectedStudent && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-gray-800">{selectedStudent.nama_siswa}</h3>
              <p className="text-gray-600">ID: {selectedStudent.id_siswa}</p>
            </div>
            <Button
              variant="outline"
              icon="arrow-left"
              onClick={() => {
                setActiveView('students');
                setSelectedStudent(null);
                setStudentHistory(null);
              }}
            >
              Kembali ke Daftar Siswa
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Rata-rata Semester Ini</p>
              <p className="text-3xl font-bold text-blue-600">{selectedStudent.overall_final_average}</p>
            </div>
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Mapel Tertinggi</p>
              <p className="text-xl font-bold text-green-600">
                {(() => {
                  let highest = 0;
                  let mapelName = '-';
                  allSubjectNames.forEach(subject => {
                    const avg = selectedStudent[`${subject}_RataRata`];
                    if (avg && avg > highest) {
                      highest = avg;
                      mapelName = subject;
                    }
                  });
                  return mapelName;
                })()}
              </p>
              <p className="text-sm text-gray-500">
                {Math.max(...allSubjectNames.map(s => selectedStudent[`${s}_RataRata`] || 0))}
              </p>
            </div>
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Mapel Terendah</p>
              <p className="text-xl font-bold text-red-600">
                {(() => {
                  let lowest = 100;
                  let mapelName = '-';
                  allSubjectNames.forEach(subject => {
                    const avg = selectedStudent[`${subject}_RataRata`];
                    if (avg && avg < lowest) {
                      lowest = avg;
                      mapelName = subject;
                    }
                  });
                  return mapelName;
                })()}
              </p>
              <p className="text-sm text-gray-500">
                {Math.min(...allSubjectNames.map(s => selectedStudent[`${s}_RataRata`] || 100).filter(v => v > 0))}
              </p>
            </div>
          </div>

          {studentHistory && studentHistory.data && studentHistory.data.length > 0 && (
            <div>
              <div className="mb-6 p-4 bg-white border rounded-lg shadow">
                <h4 className="font-semibold text-gray-700 mb-4">
                  <i className="fas fa-chart-line mr-2"></i>
                  Histori Nilai Siswa (Multi-Semester)
                </h4>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={studentHistoryChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" angle={-25} textAnchor="end" height={100} interval={0} />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    {studentHistoryMapels.map((mapel, idx) => (
                      <Line
                        key={idx}
                        type="monotone"
                        dataKey={mapel}
                        stroke={COLORS[idx % COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        connectNulls={true}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-6 p-4 bg-white border rounded-lg shadow">
                <h4 className="font-semibold text-gray-700 mb-4 flex items-center">
                  <i className="fas fa-network-wired mr-2"></i>
                  Profil Mata Pelajaran (Radar)
                </h4>
                {allSubjectNames.length === 0 ? (
                  <div className="text-sm text-gray-600">Belum ada mata pelajaran untuk ditampilkan.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={350}>
                    <RadarChart cx="50%" cy="50%" outerRadius={120} data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name={selectedStudent.nama_siswa} dataKey="value" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                      <Tooltip />
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}

          <div className="p-4 bg-white border rounded-lg shadow">
            <h4 className="font-semibold text-gray-700 mb-4">Nilai Semester Ini</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 border text-left">Mata Pelajaran</th>
                    <th className="px-4 py-2 border text-center">Rata-rata</th>
                    <th className="px-4 py-2 border text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {allSubjectNames.map(subject => {
                    const avg = selectedStudent[`${subject}_RataRata`];
                    const status = avg >= 75 ? 'Baik' : avg >= 60 ? 'Cukup' : 'Perlu Perbaikan';
                    const statusColor = avg >= 75 ? 'text-green-600' : avg >= 60 ? 'text-yellow-600' : 'text-red-600';
                    
                    return (
                      <tr key={subject} className="hover:bg-gray-50">
                        <td className="px-4 py-2 border">{subject}</td>
                        <td className="px-4 py-2 border text-center font-semibold">{avg || '-'}</td>
                        <td className={`px-4 py-2 border text-center ${statusColor}`}>{avg ? status : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </ModuleContainer>
  );
};

export default WaliKelasGradeView;
