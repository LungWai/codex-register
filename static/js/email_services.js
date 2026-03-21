/**
 * 邮箱服务页面 JavaScript
 */

// 状态
let outlookServices = [];
let customServices = [];  // 合并 custom_domain + temp_mail
let selectedOutlook = new Set();
let selectedCustom = new Set();

// DOM 元素
const elements = {
    // 统计
    outlookCount: document.getElementById('outlook-count'),
    customCount: document.getElementById('custom-count'),
    tempmailStatus: document.getElementById('tempmail-status'),
    totalEnabled: document.getElementById('total-enabled'),

    // Outlook 导入
    toggleOutlookImport: document.getElementById('toggle-outlook-import'),
    outlookImportBody: document.getElementById('outlook-import-body'),
    outlookImportData: document.getElementById('outlook-import-data'),
    outlookImportEnabled: document.getElementById('outlook-import-enabled'),
    outlookImportPriority: document.getElementById('outlook-import-priority'),
    outlookImportBtn: document.getElementById('outlook-import-btn'),
    clearImportBtn: document.getElementById('clear-import-btn'),
    importResult: document.getElementById('import-result'),

    // Outlook 列表
    outlookTable: document.getElementById('outlook-accounts-table'),
    selectAllOutlook: document.getElementById('select-all-outlook'),
    batchDeleteOutlookBtn: document.getElementById('batch-delete-outlook-btn'),

    // 自定义域名（合并）
    customTable: document.getElementById('custom-services-table'),
    addCustomBtn: document.getElementById('add-custom-btn'),
    selectAllCustom: document.getElementById('select-all-custom'),

    // 临时邮箱
    tempmailForm: document.getElementById('tempmail-form'),
    tempmailApi: document.getElementById('tempmail-api'),
    tempmailEnabled: document.getElementById('tempmail-enabled'),
    testTempmailBtn: document.getElementById('test-tempmail-btn'),

    // 添加自定义域名模态框
    addCustomModal: document.getElementById('add-custom-modal'),
    addCustomForm: document.getElementById('add-custom-form'),
    closeCustomModal: document.getElementById('close-custom-modal'),
    cancelAddCustom: document.getElementById('cancel-add-custom'),
    customSubType: document.getElementById('custom-sub-type'),
    addMoemailFields: document.getElementById('add-moemail-fields'),
    addTempmailFields: document.getElementById('add-tempmail-fields'),

    // 编辑自定义域名模态框
    editCustomModal: document.getElementById('edit-custom-modal'),
    editCustomForm: document.getElementById('edit-custom-form'),
    closeEditCustomModal: document.getElementById('close-edit-custom-modal'),
    cancelEditCustom: document.getElementById('cancel-edit-custom'),
    editMoemailFields: document.getElementById('edit-moemail-fields'),
    editTempmailFields: document.getElementById('edit-tempmail-fields'),
    editCustomTypeBadge: document.getElementById('edit-custom-type-badge'),
    editCustomSubTypeHidden: document.getElementById('edit-custom-sub-type-hidden'),

    // 编辑 Outlook 模态框
    editOutlookModal: document.getElementById('edit-outlook-modal'),
    editOutlookForm: document.getElementById('edit-outlook-form'),
    closeEditOutlookModal: document.getElementById('close-edit-outlook-modal'),
    cancelEditOutlook: document.getElementById('cancel-edit-outlook'),
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadOutlookServices();
    loadCustomServices();
    loadTempmailConfig();
    initEventListeners();
});

// 事件监听
function initEventListeners() {
    // Outlook 导入展开/收起
    elements.toggleOutlookImport.addEventListener('click', () => {
        const isHidden = elements.outlookImportBody.style.display === 'none';
        elements.outlookImportBody.style.display = isHidden ? 'block' : 'none';
        elements.toggleOutlookImport.textContent = isHidden ? '收起' : '展开';
    });

    // Outlook 导入
    elements.outlookImportBtn.addEventListener('click', handleOutlookImport);
    elements.clearImportBtn.addEventListener('click', () => {
        elements.outlookImportData.value = '';
        elements.importResult.style.display = 'none';
    });

    // Outlook 全选
    elements.selectAllOutlook.addEventListener('change', (e) => {
        const checkboxes = elements.outlookTable.querySelectorAll('input[type="checkbox"][data-id]');
        checkboxes.forEach(cb => {
            cb.checked = e.target.checked;
            const id = parseInt(cb.dataset.id);
            if (e.target.checked) selectedOutlook.add(id);
            else selectedOutlook.delete(id);
        });
        updateBatchButtons();
    });

    // Outlook 批量删除
    elements.batchDeleteOutlookBtn.addEventListener('click', handleBatchDeleteOutlook);

    // 自定义域名全选
    elements.selectAllCustom.addEventListener('change', (e) => {
        const checkboxes = elements.customTable.querySelectorAll('input[type="checkbox"][data-id]');
        checkboxes.forEach(cb => {
            cb.checked = e.target.checked;
            const id = parseInt(cb.dataset.id);
            if (e.target.checked) selectedCustom.add(id);
            else selectedCustom.delete(id);
        });
    });

    // 添加自定义域名
    elements.addCustomBtn.addEventListener('click', () => {
        elements.addCustomForm.reset();
        switchAddSubType('moemail');
        elements.addCustomModal.classList.add('active');
    });
    elements.closeCustomModal.addEventListener('click', () => elements.addCustomModal.classList.remove('active'));
    elements.cancelAddCustom.addEventListener('click', () => elements.addCustomModal.classList.remove('active'));
    elements.addCustomForm.addEventListener('submit', handleAddCustom);

    // 类型切换（添加表单）
    elements.customSubType.addEventListener('change', (e) => switchAddSubType(e.target.value));

    // DuckMail 模式切换（添加表单）
    const addDmMode = document.getElementById('custom-dm-mode');
    if (addDmMode) {
        addDmMode.addEventListener('change', (e) => switchAddDmMode(e.target.value));
    }

    // DuckMail 模式切换（编辑表单）
    const editDmMode = document.getElementById('edit-dm-mode');
    if (editDmMode) {
        editDmMode.addEventListener('change', (e) => switchEditDmMode(e.target.value));
    }

    // 编辑自定义域名
    elements.closeEditCustomModal.addEventListener('click', () => elements.editCustomModal.classList.remove('active'));
    elements.cancelEditCustom.addEventListener('click', () => elements.editCustomModal.classList.remove('active'));
    elements.editCustomForm.addEventListener('submit', handleEditCustom);

    // 编辑 Outlook
    elements.closeEditOutlookModal.addEventListener('click', () => elements.editOutlookModal.classList.remove('active'));
    elements.cancelEditOutlook.addEventListener('click', () => elements.editOutlookModal.classList.remove('active'));
    elements.editOutlookForm.addEventListener('submit', handleEditOutlook);

    // 临时邮箱配置
    elements.tempmailForm.addEventListener('submit', handleSaveTempmail);
    elements.testTempmailBtn.addEventListener('click', handleTestTempmail);
}

// 切换添加表单子类型
function switchAddSubType(subType) {
    elements.customSubType.value = subType;
    const addDuckmailFields = document.getElementById('add-duckmail-fields');
    elements.addMoemailFields.style.display = subType === 'moemail' ? '' : 'none';
    elements.addTempmailFields.style.display = subType === 'tempmail' ? '' : 'none';
    if (addDuckmailFields) addDuckmailFields.style.display = subType === 'duckmail' ? '' : 'none';
}

// DuckMail 添加表单模式切换
function switchAddDmMode(mode) {
    const directFields = document.getElementById('add-dm-direct-fields');
    const proxiedFields = document.getElementById('add-dm-proxied-fields');
    if (directFields) directFields.style.display = mode === 'direct' ? '' : 'none';
    if (proxiedFields) proxiedFields.style.display = mode === 'proxied' ? '' : 'none';
}

// DuckMail 编辑表单模式切换
function switchEditDmMode(mode) {
    const directFields = document.getElementById('edit-dm-direct-fields');
    const proxiedFields = document.getElementById('edit-dm-proxied-fields');
    if (directFields) directFields.style.display = mode === 'direct' ? '' : 'none';
    if (proxiedFields) proxiedFields.style.display = mode === 'proxied' ? '' : 'none';
}

// 切换编辑表单子类型显示
function switchEditSubType(subType) {
    elements.editCustomSubTypeHidden.value = subType;
    elements.editMoemailFields.style.display = subType === 'moemail' ? '' : 'none';
    elements.editTempmailFields.style.display = subType === 'tempmail' ? '' : 'none';
    const editDuckmailFields = document.getElementById('edit-duckmail-fields');
    if (editDuckmailFields) editDuckmailFields.style.display = subType === 'duckmail' ? '' : 'none';

    const labels = {
        moemail: '🔗 MoeMail（自定义域名 API）',
        tempmail: '📮 TempMail（自部署 Cloudflare Worker）',
        duckmail: '🦆 DuckMail（mail.tm 兼容 Worker）',
    };
    elements.editCustomTypeBadge.textContent = labels[subType] || subType;
}

// 加载统计信息
async function loadStats() {
    try {
        const data = await api.get('/email-services/stats');
        elements.outlookCount.textContent = data.outlook_count || 0;
        elements.customCount.textContent = (data.custom_count || 0) + (data.temp_mail_count || 0) + (data.duck_mail_count || 0);
        elements.tempmailStatus.textContent = data.tempmail_available ? '可用' : '不可用';
        elements.totalEnabled.textContent = data.enabled_count || 0;
    } catch (error) {
        console.error('加载统计信息失败:', error);
    }
}

// 加载 Outlook 服务
async function loadOutlookServices() {
    try {
        const data = await api.get('/email-services?service_type=outlook');
        outlookServices = data.services || [];

        if (outlookServices.length === 0) {
            elements.outlookTable.innerHTML = `
                <tr>
                    <td colspan="7">
                        <div class="empty-state">
                            <div class="empty-state-icon">📭</div>
                            <div class="empty-state-title">暂无 Outlook 账户</div>
                            <div class="empty-state-description">请使用上方导入功能添加账户</div>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        elements.outlookTable.innerHTML = outlookServices.map(service => `
            <tr data-id="${service.id}">
                <td><input type="checkbox" data-id="${service.id}" ${selectedOutlook.has(service.id) ? 'checked' : ''}></td>
                <td>${escapeHtml(service.config?.email || service.name)}</td>
                <td>
                    <span class="status-badge ${service.config?.has_oauth ? 'active' : 'pending'}">
                        ${service.config?.has_oauth ? 'OAuth' : '密码'}
                    </span>
                </td>
                <td>
                    <span class="status-badge ${service.enabled ? 'active' : 'disabled'}">
                        ${service.enabled ? '启用' : '禁用'}
                    </span>
                </td>
                <td>${service.priority}</td>
                <td>${format.date(service.last_used)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-ghost btn-sm" onclick="editOutlookService(${service.id})" title="编辑">✏️</button>
                        <button class="btn btn-ghost btn-sm" onclick="toggleService(${service.id}, ${!service.enabled})" title="${service.enabled ? '禁用' : '启用'}">${service.enabled ? '🔇' : '🔊'}</button>
                        <button class="btn btn-ghost btn-sm" onclick="testService(${service.id})" title="测试">🔌</button>
                        <button class="btn btn-ghost btn-sm" onclick="deleteService(${service.id}, '${escapeHtml(service.name)}')" title="删除">🗑️</button>
                    </div>
                </td>
            </tr>
        `).join('');

        elements.outlookTable.querySelectorAll('input[type="checkbox"][data-id]').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const id = parseInt(e.target.dataset.id);
                if (e.target.checked) selectedOutlook.add(id);
                else selectedOutlook.delete(id);
                updateBatchButtons();
            });
        });

    } catch (error) {
        console.error('加载 Outlook 服务失败:', error);
        elements.outlookTable.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-title">加载失败</div></div></td></tr>`;
    }
}

// 加载自定义域名服务（custom_domain + temp_mail + duck_mail 合并）
async function loadCustomServices() {
    try {
        const [r1, r2, r3] = await Promise.all([
            api.get('/email-services?service_type=custom_domain'),
            api.get('/email-services?service_type=temp_mail'),
            api.get('/email-services?service_type=duck_mail')
        ]);
        customServices = [
            ...(r1.services || []).map(s => ({ ...s, _subType: 'moemail' })),
            ...(r2.services || []).map(s => ({ ...s, _subType: 'tempmail' })),
            ...(r3.services || []).map(s => ({ ...s, _subType: 'duckmail' }))
        ];

        if (customServices.length === 0) {
            elements.customTable.innerHTML = `
                <tr>
                    <td colspan="8">
                        <div class="empty-state">
                            <div class="empty-state-icon">📭</div>
                            <div class="empty-state-title">暂无自定义域名服务</div>
                            <div class="empty-state-description">点击「添加服务」按钮创建新服务</div>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        elements.customTable.innerHTML = customServices.map(service => {
            const typeLabels = {
                moemail: '<span class="status-badge info">MoeMail</span>',
                tempmail: '<span class="status-badge warning">TempMail</span>',
                duckmail: '<span class="status-badge active">DuckMail</span>',
            };
            const typeLabel = typeLabels[service._subType] || service._subType;
            let addr = service.config?.base_url || '-';
            if (service._subType === 'duckmail') {
                const mode = service.config?.mode || 'direct';
                addr = mode === 'proxied' ? (service.config?.proxy_url || '-') : (service.config?.base_url || '-');
            }
            return `
            <tr data-id="${service.id}">
                <td><input type="checkbox" data-id="${service.id}" ${selectedCustom.has(service.id) ? 'checked' : ''}></td>
                <td>${escapeHtml(service.name)}</td>
                <td>${typeLabel}</td>
                <td style="font-size: 0.75rem;">${escapeHtml(addr)}</td>
                <td><span class="status-badge ${service.enabled ? 'active' : 'disabled'}">${service.enabled ? '启用' : '禁用'}</span></td>
                <td>${service.priority}</td>
                <td>${format.date(service.last_used)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-ghost btn-sm" onclick="editCustomService(${service.id}, '${service._subType}')" title="编辑">✏️</button>
                        <button class="btn btn-ghost btn-sm" onclick="toggleService(${service.id}, ${!service.enabled})" title="${service.enabled ? '禁用' : '启用'}">${service.enabled ? '🔇' : '🔊'}</button>
                        <button class="btn btn-ghost btn-sm" onclick="testService(${service.id})" title="测试">🔌</button>
                        <button class="btn btn-ghost btn-sm" onclick="deleteService(${service.id}, '${escapeHtml(service.name)}')" title="删除">🗑️</button>
                    </div>
                </td>
            </tr>`;
        }).join('');

        elements.customTable.querySelectorAll('input[type="checkbox"][data-id]').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const id = parseInt(e.target.dataset.id);
                if (e.target.checked) selectedCustom.add(id);
                else selectedCustom.delete(id);
            });
        });

    } catch (error) {
        console.error('加载自定义域名服务失败:', error);
    }
}

// 加载临时邮箱配置
async function loadTempmailConfig() {
    try {
        const settings = await api.get('/settings');
        if (settings.tempmail) {
            elements.tempmailApi.value = settings.tempmail.api_url || '';
            elements.tempmailEnabled.checked = settings.tempmail.enabled !== false;
        }
    } catch (error) {
        // 忽略错误
    }
}

// Outlook 导入
async function handleOutlookImport() {
    const data = elements.outlookImportData.value.trim();
    if (!data) { toast.error('请输入导入数据'); return; }

    elements.outlookImportBtn.disabled = true;
    elements.outlookImportBtn.textContent = '导入中...';

    try {
        const result = await api.post('/email-services/outlook/batch-import', {
            data: data,
            enabled: elements.outlookImportEnabled.checked,
            priority: parseInt(elements.outlookImportPriority.value) || 0
        });

        elements.importResult.style.display = 'block';
        elements.importResult.innerHTML = `
            <div class="import-stats">
                <span>✅ 成功导入: <strong>${result.success || 0}</strong></span>
                <span>❌ 失败: <strong>${result.failed || 0}</strong></span>
            </div>
            ${result.errors?.length ? `<div class="import-errors" style="margin-top: var(--spacing-sm);"><strong>错误详情：</strong><ul>${result.errors.map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ul></div>` : ''}
        `;

        if (result.success > 0) {
            toast.success(`成功导入 ${result.success} 个账户`);
            loadOutlookServices();
            loadStats();
            elements.outlookImportData.value = '';
        }
    } catch (error) {
        toast.error('导入失败: ' + error.message);
    } finally {
        elements.outlookImportBtn.disabled = false;
        elements.outlookImportBtn.textContent = '📥 开始导入';
    }
}

// 添加自定义域名服务（根据子类型区分）
async function handleAddCustom(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const subType = formData.get('sub_type');

    let serviceType, config;
    if (subType === 'moemail') {
        serviceType = 'custom_domain';
        config = {
            base_url: formData.get('api_url'),
            api_key: formData.get('api_key'),
            default_domain: formData.get('domain')
        };
    } else if (subType === 'duckmail') {
        serviceType = 'duck_mail';
        const mode = formData.get('dm_mode') || 'direct';
        config = {
            mode: mode,
            domain: formData.get('dm_domain'),
        };
        if (mode === 'proxied') {
            config.proxy_url = formData.get('dm_proxy_url');
            config.worker_url = formData.get('dm_worker_url') || '';
        } else {
            config.base_url = formData.get('dm_base_url');
        }
        const pw = formData.get('dm_password');
        if (pw && pw.trim()) config.password = pw.trim();
    } else {
        serviceType = 'temp_mail';
        config = {
            base_url: formData.get('tm_base_url'),
            admin_password: formData.get('tm_admin_password'),
            domain: formData.get('tm_domain'),
            enable_prefix: true
        };
    }

    const data = {
        service_type: serviceType,
        name: formData.get('name'),
        config,
        enabled: formData.get('enabled') === 'on',
        priority: parseInt(formData.get('priority')) || 0
    };

    try {
        await api.post('/email-services', data);
        toast.success('服务添加成功');
        elements.addCustomModal.classList.remove('active');
        e.target.reset();
        loadCustomServices();
        loadStats();
    } catch (error) {
        toast.error('添加失败: ' + error.message);
    }
}

// 切换服务状态
async function toggleService(id, enabled) {
    try {
        await api.patch(`/email-services/${id}`, { enabled });
        toast.success(enabled ? '已启用' : '已禁用');
        loadOutlookServices();
        loadCustomServices();
        loadStats();
    } catch (error) {
        toast.error('操作失败: ' + error.message);
    }
}

// 测试服务
async function testService(id) {
    try {
        const result = await api.post(`/email-services/${id}/test`);
        if (result.success) toast.success('测试成功');
        else toast.error('测试失败: ' + (result.error || '未知错误'));
    } catch (error) {
        toast.error('测试失败: ' + error.message);
    }
}

// 删除服务
async function deleteService(id, name) {
    const confirmed = await confirm(`确定要删除 "${name}" 吗？`);
    if (!confirmed) return;
    try {
        await api.delete(`/email-services/${id}`);
        toast.success('已删除');
        selectedOutlook.delete(id);
        selectedCustom.delete(id);
        loadOutlookServices();
        loadCustomServices();
        loadStats();
    } catch (error) {
        toast.error('删除失败: ' + error.message);
    }
}

// 批量删除 Outlook
async function handleBatchDeleteOutlook() {
    if (selectedOutlook.size === 0) return;
    const confirmed = await confirm(`确定要删除选中的 ${selectedOutlook.size} 个账户吗？`);
    if (!confirmed) return;
    try {
        const result = await api.request('/email-services/outlook/batch', {
            method: 'DELETE',
            body: Array.from(selectedOutlook)
        });
        toast.success(`成功删除 ${result.deleted || selectedOutlook.size} 个账户`);
        selectedOutlook.clear();
        loadOutlookServices();
        loadStats();
    } catch (error) {
        toast.error('删除失败: ' + error.message);
    }
}

// 保存临时邮箱配置
async function handleSaveTempmail(e) {
    e.preventDefault();
    try {
        await api.post('/settings/tempmail', {
            api_url: elements.tempmailApi.value,
            enabled: elements.tempmailEnabled.checked
        });
        toast.success('配置已保存');
    } catch (error) {
        toast.error('保存失败: ' + error.message);
    }
}

// 测试临时邮箱
async function handleTestTempmail() {
    elements.testTempmailBtn.disabled = true;
    elements.testTempmailBtn.textContent = '测试中...';
    try {
        const result = await api.post('/email-services/test-tempmail', {
            api_url: elements.tempmailApi.value
        });
        if (result.success) toast.success('临时邮箱连接正常');
        else toast.error('连接失败: ' + (result.error || '未知错误'));
    } catch (error) {
        toast.error('测试失败: ' + error.message);
    } finally {
        elements.testTempmailBtn.disabled = false;
        elements.testTempmailBtn.textContent = '🔌 测试连接';
    }
}

// 更新批量按钮
function updateBatchButtons() {
    const count = selectedOutlook.size;
    elements.batchDeleteOutlookBtn.disabled = count === 0;
    elements.batchDeleteOutlookBtn.textContent = count > 0 ? `🗑️ 删除选中 (${count})` : '🗑️ 批量删除';
}

// HTML 转义
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============== 编辑功能 ==============

// 编辑自定义域名服务（支持 moemail / tempmail / duckmail）
async function editCustomService(id, subType) {
    try {
        const service = await api.get(`/email-services/${id}/full`);
        let resolvedSubType = subType;
        if (!resolvedSubType) {
            if (service.service_type === 'duck_mail') resolvedSubType = 'duckmail';
            else if (service.service_type === 'temp_mail') resolvedSubType = 'tempmail';
            else resolvedSubType = 'moemail';
        }

        document.getElementById('edit-custom-id').value = service.id;
        document.getElementById('edit-custom-name').value = service.name || '';
        document.getElementById('edit-custom-priority').value = service.priority || 0;
        document.getElementById('edit-custom-enabled').checked = service.enabled;

        switchEditSubType(resolvedSubType);

        if (resolvedSubType === 'moemail') {
            document.getElementById('edit-custom-api-url').value = service.config?.base_url || '';
            document.getElementById('edit-custom-api-key').value = '';
            document.getElementById('edit-custom-api-key').placeholder = service.config?.has_api_key ? '已设置，留空保持不变' : 'API Key';
            document.getElementById('edit-custom-domain').value = service.config?.default_domain || service.config?.domain || '';
        } else if (resolvedSubType === 'duckmail') {
            const mode = service.config?.mode || 'direct';
            document.getElementById('edit-dm-mode').value = mode;
            switchEditDmMode(mode);
            document.getElementById('edit-dm-base-url').value = service.config?.base_url || '';
            document.getElementById('edit-dm-proxy-url').value = service.config?.proxy_url || '';
            document.getElementById('edit-dm-worker-url').value = service.config?.worker_url || '';
            document.getElementById('edit-dm-domain').value = service.config?.domain || '';
            document.getElementById('edit-dm-password').value = '';
            document.getElementById('edit-dm-password').placeholder = service.config?.password ? '已设置，留空保持不变' : '留空自动生成';
        } else {
            document.getElementById('edit-tm-base-url').value = service.config?.base_url || '';
            document.getElementById('edit-tm-admin-password').value = '';
            document.getElementById('edit-tm-admin-password').placeholder = service.config?.admin_password ? '已设置，留空保持不变' : '请输入 Admin 密码';
            document.getElementById('edit-tm-domain').value = service.config?.domain || '';
        }

        elements.editCustomModal.classList.add('active');
    } catch (error) {
        toast.error('获取服务信息失败: ' + error.message);
    }
}

// 保存编辑自定义域名服务
async function handleEditCustom(e) {
    e.preventDefault();
    const id = document.getElementById('edit-custom-id').value;
    const formData = new FormData(e.target);
    const subType = formData.get('sub_type');

    let config;
    if (subType === 'moemail') {
        config = {
            base_url: formData.get('api_url'),
            default_domain: formData.get('domain')
        };
        const apiKey = formData.get('api_key');
        if (apiKey && apiKey.trim()) config.api_key = apiKey.trim();
    } else if (subType === 'duckmail') {
        const mode = formData.get('dm_mode') || 'direct';
        config = {
            mode: mode,
            domain: formData.get('dm_domain'),
        };
        if (mode === 'proxied') {
            config.proxy_url = formData.get('dm_proxy_url');
            config.worker_url = formData.get('dm_worker_url') || '';
        } else {
            config.base_url = formData.get('dm_base_url');
        }
        const pw = formData.get('dm_password');
        if (pw && pw.trim()) config.password = pw.trim();
    } else {
        config = {
            base_url: formData.get('tm_base_url'),
            domain: formData.get('tm_domain'),
            enable_prefix: true
        };
        const pwd = formData.get('tm_admin_password');
        if (pwd && pwd.trim()) config.admin_password = pwd.trim();
    }

    const updateData = {
        name: formData.get('name'),
        priority: parseInt(formData.get('priority')) || 0,
        enabled: formData.get('enabled') === 'on',
        config
    };

    try {
        await api.patch(`/email-services/${id}`, updateData);
        toast.success('服务更新成功');
        elements.editCustomModal.classList.remove('active');
        loadCustomServices();
        loadStats();
    } catch (error) {
        toast.error('更新失败: ' + error.message);
    }
}

// 编辑 Outlook 服务
async function editOutlookService(id) {
    try {
        const service = await api.get(`/email-services/${id}/full`);
        document.getElementById('edit-outlook-id').value = service.id;
        document.getElementById('edit-outlook-email').value = service.config?.email || service.name || '';
        document.getElementById('edit-outlook-password').value = '';
        document.getElementById('edit-outlook-password').placeholder = service.config?.password ? '已设置，留空保持不变' : '请输入密码';
        document.getElementById('edit-outlook-client-id').value = service.config?.client_id || '';
        document.getElementById('edit-outlook-refresh-token').value = '';
        document.getElementById('edit-outlook-refresh-token').placeholder = service.config?.refresh_token ? '已设置，留空保持不变' : 'OAuth Refresh Token';
        document.getElementById('edit-outlook-priority').value = service.priority || 0;
        document.getElementById('edit-outlook-enabled').checked = service.enabled;
        elements.editOutlookModal.classList.add('active');
    } catch (error) {
        toast.error('获取服务信息失败: ' + error.message);
    }
}

// 保存编辑 Outlook 服务
async function handleEditOutlook(e) {
    e.preventDefault();
    const id = document.getElementById('edit-outlook-id').value;
    const formData = new FormData(e.target);

    let currentService;
    try {
        currentService = await api.get(`/email-services/${id}/full`);
    } catch (error) {
        toast.error('获取服务信息失败');
        return;
    }

    const updateData = {
        name: formData.get('email'),
        priority: parseInt(formData.get('priority')) || 0,
        enabled: formData.get('enabled') === 'on',
        config: {
            email: formData.get('email'),
            password: formData.get('password')?.trim() || currentService.config?.password || '',
            client_id: formData.get('client_id')?.trim() || currentService.config?.client_id || '',
            refresh_token: formData.get('refresh_token')?.trim() || currentService.config?.refresh_token || ''
        }
    };

    try {
        await api.patch(`/email-services/${id}`, updateData);
        toast.success('账户更新成功');
        elements.editOutlookModal.classList.remove('active');
        loadOutlookServices();
        loadStats();
    } catch (error) {
        toast.error('更新失败: ' + error.message);
    }
}
