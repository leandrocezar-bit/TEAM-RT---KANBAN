const fs = require('fs');
let lines = fs.readFileSync('index.html', 'utf8').split('\n');

lines[440] = '        <!-- COLUNA EM EXECUÇÃO -->\r';
lines[441] = '        <div class="kanban-column col-wip" data-status="EM EXECUÇÃO">\r';
lines[446] = '              ⚡ EM EXECUÇÃO\r';

lines[460] = '        <!-- COLUNA CONCLUÍDO -->\r';
lines[461] = '        <div class="kanban-column col-done" data-status="CONCLUÍDO">\r';
lines[466] = '              ✅ CONCLUÍDO\r';

fs.writeFileSync('index.html', lines.join('\n'));
