const https = require('https');

const cookie = 'lu_site_auth=' + encodeURIComponent(JSON.stringify({authed:true,expires_at:Date.now()+3600000}));

const opts = {
  hostname: 'level-up-playbook.vercel.app',
  path: '/api/tasks',
  headers: { 'Cookie': cookie }
};

https.get(opts, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const d = JSON.parse(data);
    const tasks = d.tasks || [];
    
    // Break down by project
    const byProject = {};
    tasks.forEach(t => {
      const p = t.project || '(none)';
      if (!byProject[p]) byProject[p] = { total: 0, withDD: 0 };
      byProject[p].total++;
      if (t.dueDate) byProject[p].withDD++;
    });
    
    console.log('By project:');
    Object.keys(byProject).sort().forEach(p => {
      const info = byProject[p];
      console.log('  ' + p + ': ' + info.total + ' tasks, ' + info.withDD + ' with due dates (' + Math.round(info.withDD/info.total*100) + '%)');
    });
    
    // Check personal sheet tasks
    const personal = tasks.filter(t => t.source === 'personal');
    console.log('\nPersonal sheet: ' + personal.length + ' tasks');
    const personalDD = personal.filter(t => t.dueDate);
    console.log('  With due dates: ' + personalDD.length);
    
    // Check when due dates DO appear — are they really showing?
    console.log('\nSample task objects:');
    let taken = 0;
    tasks.forEach(t => {
      if (t.dueDate && taken < 3) {
        console.log(JSON.stringify({
          rowId: t.rowId,
          actionItem: (t.actionItem||'').substring(0,40),
          dueDate: t.dueDate,
          status: t.status,
          project: t.project
        }));
        taken++;
      }
    });
  });
}).on('error', e => console.log('Error:', e.message));