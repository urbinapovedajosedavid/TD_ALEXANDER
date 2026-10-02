        let backupsData = [
            { id: 1, fecha: "24/10/2023, 14:30", tamaño: "450 MB", ruta: "D:\\Backups\\GESPRO_2023_10_24.zip", estado: "Complete", statusColor: "emerald" },
            { id: 2, fecha: "24/10/2023, 02:00", tamaño: "448 MB", ruta: "D:\\Backups\\GESPRO_2023_10_24_auto.zip", estado: "Complete", statusColor: "emerald" },
            { id: 3, fecha: "23/10/2023, 02:00", tamaño: "442 MB", ruta: "D:\\Backups\\GESPRO_2023_10_23_auto.zip", estado: "Complete", statusColor: "emerald" },
            { id: 4, fecha: "22/10/2023, 02:00", tamaño: "440 MB", ruta: "D:\\Backups\\GESPRO_2023_10_22_auto.zip", estado: "Complete", statusColor: "emerald" }
        ];

        let isBackupRunning = false;

        document.addEventListener('DOMContentLoaded', () => {
            lucide.createIcons();
            renderTable();
            populateRestoreOptions();
        });

        function toggleDarkMode() {
            const html = document.documentElement;
            const themeIcon = document.getElementById('themeIcon');
            if (html.classList.contains('dark')) {
                html.classList.remove('dark');
                themeIcon.setAttribute('data-lucide', 'moon');
            } else {
                html.classList.add('dark');
                themeIcon.setAttribute('data-lucide', 'sun');
            }
            lucide.createIcons();
        }

        function switchTab(tabName) {
            const btnGestion = document.getElementById('tab-gestion');
            const btnConfig = document.getElementById('tab-configuracion');
            const contentGestion = document.getElementById('content-gestion');
            const contentConfig = document.getElementById('content-configuracion');

            if (tabName === 'gestion') {
                btnGestion.className = "tab-button border-b-2 border-blue-600 text-blue-600 dark:text-blue-400 font-semibold py-3 px-1 text-sm flex items-center gap-2 transition-colors";
                btnConfig.className = "tab-button border-b-2 border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium py-3 px-1 text-sm flex items-center gap-2 transition-colors";
                contentGestion.classList.remove('hidden');
                contentConfig.classList.add('hidden');
            } else {
                btnConfig.className = "tab-button border-b-2 border-blue-600 text-blue-600 dark:text-blue-400 font-semibold py-3 px-1 text-sm flex items-center gap-2 transition-colors";
                btnGestion.className = "tab-button border-b-2 border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium py-3 px-1 text-sm flex items-center gap-2 transition-colors";
                contentConfig.classList.remove('hidden');
                contentGestion.classList.add('hidden');
            }
        }

        function renderTable(filterQuery = '') {
            const tbody = document.getElementById('backupTableBody');
            tbody.innerHTML = '';

            const filtered = backupsData.filter(item => 
                item.ruta.toLowerCase().includes(filterQuery.toLowerCase()) ||
                item.fecha.toLowerCase().includes(filterQuery.toLowerCase()) ||
                item.id.toString().includes(filterQuery)
            );

            if (filtered.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="py-6 text-center text-slate-400 dark:text-slate-500 text-xs">
                            No se encontraron registros de respaldo.
                        </td>
                    </tr>
                `;
                return;
            }

            filtered.forEach(item => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors border-b border-slate-100 dark:border-slate-700/50";
                
                tr.innerHTML = `
                    <td class="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100">${item.id}</td>
                    <td class="py-2.5 px-3 text-slate-600 dark:text-slate-300">${item.fecha}</td>
                    <td class="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">${item.tamaño}</td>
                    <td class="py-2.5 px-3 font-mono text-xs text-slate-500 dark:text-slate-400 truncate max-w-[140px]" title="${item.ruta}">${item.ruta}</td>
                    <td class="py-2.5 px-3">
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                            ${item.estado}
                        </span>
                    </td>
                    <td class="py-2.5 px-3 text-center">
                        <div class="flex items-center justify-center gap-2">
                            <button onclick="showToast('Verificando archivo ' + '${item.ruta.replace(/\\/g, '\\\\')}')" class="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800" title="Verificar / Ok">
                                <i data-lucide="check-circle-2" class="w-4 h-4"></i>
                            </button>
                            <button onclick="deleteBackup(${item.id})" class="text-rose-500 hover:text-rose-700 dark:text-rose-400" title="Eliminar respaldo">
                                <i data-lucide="x-circle" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
            lucide.createIcons();
        }

        function filterTable() {
            const query = document.getElementById('searchInput').value;
            renderTable(query);
        }

        function populateRestoreOptions() {
            const select = document.getElementById('restoreSelect');
            select.innerHTML = '';
            backupsData.forEach(item => {
                const fileName = item.ruta.split('\\').pop();
                const option = document.createElement('option');
                option.value = fileName;
                option.textContent = `${fileName} (${item.fecha})`;
                select.appendChild(option);
            });
        }

        function startSimulatedBackup() {
            if (isBackupRunning) return;
            isBackupRunning = true;

            const btn = document.getElementById('btnStartBackup');
            const progressBar = document.getElementById('progressBar');
            const progressPercent = document.getElementById('progressPercent');
            const progressText = document.getElementById('progressText');
            const progressETA = document.getElementById('progressETA');

            btn.disabled = true;
            btn.classList.add('opacity-50', 'cursor-not-allowed');

            let currentProgress = 0;
            progressBar.style.width = '0%';
            progressPercent.textContent = '0%';
            progressText.textContent = 'Iniciando copia de seguridad...';

            const interval = setInterval(() => {
                currentProgress += Math.floor(Math.random() * 8) + 4;
                if (currentProgress >= 100) {
                    currentProgress = 100;
                    clearInterval(interval);
                    
                    progressBar.style.width = '100%';
                    progressPercent.textContent = '100%';
                    progressText.textContent = 'Copia completada exitosamente';
                    progressETA.textContent = 'ETA: 0s';

                    const now = new Date();
                    const formattedDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth()+1).toString().padStart(2, '0')}/${now.getFullYear()}, ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                    const newFileName = `GESPRO_${now.getFullYear()}_${(now.getMonth()+1).toString().padStart(2, '0')}_${now.getDate().toString().padStart(2, '0')}_manual.zip`;
                    const newPath = `D:\\Backups\\${newFileName}`;

                    const newId = backupsData.length ? Math.max(...backupsData.map(b => b.id)) + 1 : 1;
                    
                    backupsData.unshift({
                        id: newId,
                        fecha: formattedDate,
                        tamaño: "452 MB",
                        ruta: newPath,
                        estado: "Complete",
                        statusColor: "emerald"
                    });

                    document.getElementById('lastBackupDate').textContent = formattedDate;
                    document.getElementById('lastBackupSize').textContent = "452 MB";
                    document.getElementById('lastBackupPath').textContent = newPath;

                    renderTable();
                    populateRestoreOptions();
                    showToast('¡Nueva copia de seguridad creada y verificada!');

                    setTimeout(() => {
                        btn.disabled = false;
                        btn.classList.remove('opacity-50', 'cursor-not-allowed');
                        isBackupRunning = false;
                    }, 1000);

                } else {
                    progressBar.style.width = `${currentProgress}%`;
                    progressPercent.textContent = `${currentProgress}%`;
                    progressText.textContent = 'Comprimiendo archivos y base de datos...';
                    const remainingSecs = Math.max(1, Math.round((100 - currentProgress) / 10));
                    progressETA.textContent = `ETA: ~${remainingSecs}s`;
                }
            }, 300);
        }

        function scrollToHistory() {
            document.getElementById('historyCard').scrollIntoView({ behavior: 'smooth' });
        }

        function deleteBackup(id) {
            backupsData = backupsData.filter(b => b.id !== id);
            renderTable();
            populateRestoreOptions();
            showToast('Respaldo eliminado del registro');
        }

        function openRestoreModal() {
            const selectedFile = document.getElementById('restoreSelect').value;
            if (!selectedFile) {
                showToast('No hay respaldos disponibles para restaurar.');
                return;
            }
            document.getElementById('modalFileName').textContent = selectedFile;
            document.getElementById('restoreModal').classList.remove('hidden');
        }

        function closeRestoreModal() {
            document.getElementById('restoreModal').classList.add('hidden');
        }

        function confirmRestore() {
            closeRestoreModal();
            showToast('Iniciando proceso de restauración del sistema...');
            setTimeout(() => {
                showToast('¡Sistema restaurado exitosamente!');
            }, 2000);
        }

        function toggleScheduledInputs() {
            const isChecked = document.getElementById('autoBackupToggle').checked;
            const container = document.getElementById('scheduledInputsContainer');
            if (isChecked) {
                container.classList.remove('opacity-40', 'pointer-events-none');
            } else {
                container.classList.add('opacity-40', 'pointer-events-none');
            }
        }

        function saveScheduleSettings() {
            showToast('Configuración de programación guardada');
        }

        function saveGeneralConfig() {
            showToast('Ajustes generales guardados correctamente');
            switchTab('gestion');
        }

        function showToast(message) {
            const toast = document.getElementById('toastNotification');
            const msgEl = document.getElementById('toastMessage');
            msgEl.textContent = message;

            toast.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
            
            setTimeout(() => {
                toast.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none');
            }, 3500);
        }