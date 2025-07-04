/**
 * 主题配置UI管理器
 * 处理背景设置模态框中的配置切换界面
 */

class ThemeConfigUIManager {
  constructor() {
    this.newConfigModal = null;
    this.configManagementModal = null;
    this.editConfigModal = null;
    this.isInitialized = false;
    this.currentConfigs = [];
    this.filteredConfigs = [];
    this.currentEditingConfigId = null;
    this.configListClickHandler = null; // 存储事件处理器引用

    // 分页相关属性
    this.pagination = {
      currentPage: 1,
      pageSize: 10, // 恢复默认每页10条
      totalCount: 0,
      totalPages: 0
    };
    this.searchTerm = '';
    this.sortBy = 'recent';
  }

  /**
   * 获取正确的 Supabase 客户端实例
   */
  getSupabaseClient() {
    const supabaseClient = window.unifiedDataManager?.supabaseClient;
    if (!supabaseClient) {
      throw new Error('Supabase 客户端未初始化');
    }
    return supabaseClient;
  }

  /**
   * 初始化UI管理器
   */
  async init() {
    if (this.isInitialized) return;

    // 从存储中恢复用户的分页设置
    await this.loadPaginationSettings();

    // 获取模态框元素
    this.newConfigModal = document.getElementById('new-config-modal');
    this.configManagementModal = document.getElementById('config-management-modal');
    this.editConfigModal = document.getElementById('edit-config-modal');

    if (!this.newConfigModal) {
      console.error('ThemeConfigUIManager: 新建配置模态框元素未找到');
      return;
    }

    if (!this.configManagementModal) {
      console.error('ThemeConfigUIManager: 配置管理模态框元素未找到');
      return;
    }

    // 确保当前活跃配置被应用到同步管理器
    await this.applyActiveConfigToSyncManager();

    this.bindEvents();
    this.isInitialized = true;
    console.log('ThemeConfigUIManager: 初始化完成');
  }

  /**
   * 将当前活跃配置应用到同步管理器
   * 修改：检查配置是否有变化，避免重复保存相同配置
   */
  async applyActiveConfigToSyncManager() {
    try {
      const activeConfig = themeConfigManager.getActiveConfig();

      if (activeConfig && activeConfig.supabaseUrl && activeConfig.supabaseKey) {
        console.log('ThemeConfigUIManager: 检查活跃配置:', activeConfig.displayName);

        // 检查当前同步管理器配置是否已经是这个配置
        const currentConfig = await syncManager.getSupabaseConfig();
        const newConfig = {
          url: activeConfig.supabaseUrl,
          anonKey: activeConfig.supabaseKey,
          userId: activeConfig.userId,
          enabled: true
        };

        // 比较配置是否相同，避免重复保存
        const isSameConfig = currentConfig &&
          currentConfig.url === newConfig.url &&
          currentConfig.anonKey === newConfig.anonKey &&
          currentConfig.userId === newConfig.userId &&
          currentConfig.enabled === newConfig.enabled;

        if (!isSameConfig) {
          console.log('ThemeConfigUIManager: 配置有变化，更新同步管理器配置');

          // 更新同步管理器配置
          await syncManager.saveSupabaseConfig(newConfig);

          // 重新初始化同步管理器
          await syncManager.init();

          console.log('ThemeConfigUIManager: 活跃配置已应用到同步管理器');
        } else {
          console.log('ThemeConfigUIManager: 配置无变化，跳过保存操作');
        }
      } else {
        console.log('ThemeConfigUIManager: 没有有效的活跃配置，使用默认同步管理器配置');
      }
    } catch (error) {
      console.error('ThemeConfigUIManager: 应用活跃配置失败:', error);
    }
  }

  /**
   * 绑定事件监听器
   */
  bindEvents() {
    // 立即配置云端同步按钮
    const setupSyncBtn = document.getElementById('setup-sync-btn');
    if (setupSyncBtn) {
      setupSyncBtn.addEventListener('click', () => this.openSyncModal());
    }

    // 配置下拉菜单按钮
    const configDropdownBtn = document.getElementById('config-dropdown-btn');
    if (configDropdownBtn) {
      configDropdownBtn.addEventListener('click', () => this.toggleConfigDropdown());
    }

    // 新建配置按钮
    const newConfigBtn = document.getElementById('new-config-btn');
    if (newConfigBtn) {
      newConfigBtn.addEventListener('click', () => this.openNewConfigModal());
    }

    // 管理配置按钮
    const manageConfigsBtn = document.getElementById('manage-configs-btn');
    if (manageConfigsBtn) {
      manageConfigsBtn.addEventListener('click', () => this.openConfigManagementModal());
    }

    // 新建配置模态框事件
    if (this.newConfigModal) {
      const closeButtons = this.newConfigModal.querySelectorAll('.close-modal');
      closeButtons.forEach(btn => {
        btn.addEventListener('click', () => this.closeNewConfigModal());
      });

      const cancelBtn = document.getElementById('cancel-new-config-btn');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => this.closeNewConfigModal());
      }

      const form = document.getElementById('new-config-form');
      if (form) {
        form.addEventListener('submit', (e) => this.createNewConfig(e));
      }
    }

    // 点击外部关闭下拉菜单
    document.addEventListener('click', (e) => {
      const dropdown = document.querySelector('.config-dropdown');
      if (dropdown && !dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
      }
    });
  }

  /**
   * 更新配置切换区域显示
   */
  async updateConfigSwitchDisplay() {
    const configPrompt = document.getElementById('config-prompt');
    const configSelector = document.getElementById('config-selector');

    if (!configPrompt || !configSelector) return;

    const isSupabaseConfigured = await themeConfigManager.isSupabaseConfigured();

    if (!isSupabaseConfigured) {
      // 显示配置提示
      configPrompt.style.display = 'flex';
      configSelector.style.display = 'none';
    } else {
      // 显示配置选择器
      configPrompt.style.display = 'none';
      configSelector.style.display = 'block';
      await this.updateConfigSelector();
    }
  }

  /**
   * 更新配置选择器
   */
  async updateConfigSelector() {
    const configs = themeConfigManager.getAllConfigs();
    const activeConfig = themeConfigManager.getActiveConfig();

    // 更新当前配置显示
    const currentConfigName = document.getElementById('current-config-name');
    const currentConfigUser = document.getElementById('current-config-user');

    if (activeConfig) {
      if (currentConfigName) currentConfigName.textContent = activeConfig.displayName;
      if (currentConfigUser) currentConfigUser.textContent = `(${activeConfig.userId})`;
    } else {
      // 如果没有配置，显示当前Supabase配置的用户ID
      const supabaseConfig = await themeConfigManager.getCurrentSupabaseConfig();
      if (currentConfigName) currentConfigName.textContent = '默认配置';
      if (currentConfigUser) currentConfigUser.textContent = supabaseConfig.userId ? `(${supabaseConfig.userId})` : '';
    }

    // 更新下拉菜单中的配置列表
    this.updateConfigDropdownList(configs, activeConfig);
  }

  /**
   * 更新配置下拉列表
   */
  updateConfigDropdownList(configs, activeConfig) {
    const configList = document.getElementById('theme-config-list');
    if (!configList) return;

    if (configs.length === 0) {
      configList.innerHTML = '<div class="config-item">暂无其他配置</div>';
      return;
    }

    configList.innerHTML = configs.map(config => `
      <div class="config-item ${config.isActive ? 'active' : ''}" data-config-id="${config.id}">
        <div class="config-info">
          <div class="config-name">${config.displayName}</div>
          <div class="config-user">${config.userId}</div>
        </div>
      </div>
    `).join('');

    // 绑定配置项点击事件
    configList.querySelectorAll('.config-item').forEach(item => {
      item.addEventListener('click', () => {
        const configId = item.dataset.configId;
        if (configId) {
          this.switchToConfig(configId);
        }
      });
    });
  }

  /**
   * 切换下拉菜单
   */
  toggleConfigDropdown() {
    const dropdown = document.querySelector('.config-dropdown');
    if (dropdown) {
      dropdown.classList.toggle('open');
    }
  }

  /**
   * 切换到指定配置
   */
  async switchToConfig(configId) {
    let switchedConfig = null;

    try {
      console.log('开始切换配置:', configId);

      // 检查是否是动态配置（从Supabase查询的用户配置）
      const dynamicConfig = this.currentConfigs.find(c => c.id === configId);

      if (dynamicConfig) {
        console.log('切换到动态配置:', dynamicConfig);
        await this.switchToDynamicConfig(dynamicConfig);
        switchedConfig = dynamicConfig;
      } else {
        // 使用统一数据管理器切换配置
        await window.unifiedDataManager.switchConfig(configId);
        console.log('配置切换到:', configId);

        console.log('同步管理器配置已更新');

        // 重新初始化同步管理器
        await syncManager.init();

        console.log('同步管理器已重新初始化');

        // 验证连接状态
        const connectionStatus = supabaseClient.getConnectionStatus();
        console.log('切换后的连接状态:', connectionStatus);

        // 清除Chrome Storage缓存，确保重新加载正确的用户数据
        console.log('清除Chrome Storage缓存...');
        await syncManager.clearChromeStorageCache();
        console.log('缓存已清除');

        // 强制从云端重新加载数据（验证数据是否正确）
        console.log('强制从云端重新加载数据...');
        const freshData = await syncManager.loadData(true, true); // preferCloud=true, forceRefresh=true
        console.log('重新加载的数据:', freshData);

        switchedConfig = config;
      }

      // 使用统一的配置刷新入口
      console.log('🔄 开始调用统一配置刷新...');
      await this.refreshCurrentConfiguration();
      console.log('🔄 统一配置刷新完成');

      // 显示详细的切换信息
      if (switchedConfig) {
        const message = `已切换到配置: ${switchedConfig.displayName} (${switchedConfig.userId})`;
        this.showMessage(message, 'success');

        // 在控制台输出详细信息用于调试
        console.log('配置切换完成:', {
          configName: switchedConfig.displayName,
          userId: switchedConfig.userId,
          supabaseUrl: switchedConfig.supabaseUrl || '动态配置'
        });
      }
    } catch (error) {
      console.error('切换配置失败:', error);
      this.showMessage(`切换配置失败: ${error.message}`, 'error');
    }
  }

  /**
   * 切换到动态配置（从Supabase查询的用户配置）- 旁路缓存模式
   */
  async switchToDynamicConfig(config) {
    try {
      console.log('切换到动态配置（旁路缓存模式）:', config.userId);

      // 使用 UnifiedDataManager 进行配置切换
      await window.unifiedDataManager.switchConfig(config.userId);
      console.log('配置切换完成');

      // 更新 syncManager 状态（保持兼容性）
      if (typeof syncManager !== 'undefined') {
        const currentConfig = window.unifiedDataManager.getCurrentConfig();
        syncManager.isSupabaseEnabled = currentConfig.type === 'supabase';

        if (currentConfig.type === 'supabase') {
          // 从存储中获取 Supabase 配置
          const result = await new Promise((resolve) => {
            chrome.storage.sync.get(['supabase_config'], resolve);
          });
          syncManager.currentSupabaseConfig = result.supabase_config;
        }
      }

      // 5. 刷新页面组件以应用新配置
      await this.refreshPageAfterConfigSwitch();

      console.log('动态配置切换完成（旁路缓存模式），新用户ID:', config.userId);
    } catch (error) {
      console.error('切换动态配置失败:', error);
      throw error;
    }
  }

  /**
   * 配置切换后刷新页面组件
   */
  async refreshPageAfterConfigSwitch() {
    try {
      console.log('ThemeConfigUI: 配置切换后刷新页面组件');

      // 1. 重新初始化存储管理器（重新加载数据）
      if (typeof storageManager !== 'undefined') {
        await storageManager.init();
        console.log('ThemeConfigUI: 存储管理器已重新初始化');
      }

      // 2. 重新渲染分类数据
      if (typeof categoryManager !== 'undefined') {
        await categoryManager.renderCategories();
        console.log('ThemeConfigUI: 分类数据已重新渲染');
      }

      // 3. 重新应用主题设置
      if (typeof loadThemeSettings === 'function') {
        await loadThemeSettings();
        console.log('ThemeConfigUI: 主题设置已重新加载和应用');
      }

      // 4. 重新应用视图模式
      if (typeof viewManager !== 'undefined') {
        await viewManager.initView();
        console.log('ThemeConfigUI: 视图模式已重新应用');
      }

      // 5. 更新背景图片
      if (typeof updateBackgroundImageUI === 'function') {
        updateBackgroundImageUI();
        console.log('ThemeConfigUI: 背景图片UI已更新');
      }

      // 6. 更新配置切换显示
      await this.updateConfigSwitchDisplay();
      console.log('ThemeConfigUI: 配置切换显示已更新');

      console.log('ThemeConfigUI: 页面组件刷新完成');
    } catch (error) {
      console.error('ThemeConfigUI: 刷新页面组件失败:', error);
    }
  }

  /**
   * 同步动态配置到传统配置系统
   * 确保动态配置切换时，传统配置系统也能正确更新
   */
  async syncDynamicConfigToTraditional(dynamicConfig) {
    // 此方法已废弃，因为现在使用统一数据管理器
    // 保留方法签名以避免调用错误，但不执行任何操作
    console.log('syncDynamicConfigToTraditional: 方法已废弃，使用统一数据管理器');
    console.log('配置切换已通过 UnifiedDataManager 完成:', dynamicConfig.userId);
  }

  /**
   * 统一的配置刷新入口 - 全局配置数据刷新管理器
   */
  async refreshCurrentConfiguration() {
    try {
      console.log('🔄 开始刷新当前配置数据...');

      // 1. 重新加载主题设置
      if (typeof loadThemeSettings === 'function') {
        console.log('🔄 重新加载主题设置...');
        await loadThemeSettings();
        console.log('✅ 主题设置加载完成');
      } else {
        console.warn('⚠️ loadThemeSettings 函数不存在');
      }

      // 2. 更新配置选择器UI
      if (this.updateConfigSelector) {
        console.log('🔄 更新配置选择器UI...');
        await this.updateConfigSelector();
        console.log('✅ 配置选择器UI更新完成');
      } else {
        console.warn('⚠️ updateConfigSelector 方法不存在');
      }

      // 3. 更新主题选择UI
      if (typeof updateThemeOptionsUI === 'function') {
        console.log('🔄 更新主题选择UI...');
        updateThemeOptionsUI();
        console.log('✅ 主题选择UI更新完成');
      } else {
        console.warn('⚠️ updateThemeOptionsUI 函数不存在');
      }

      // 4. 更新背景图片UI
      if (typeof updateBackgroundImageUI === 'function') {
        console.log('🔄 更新背景图片UI...');
        updateBackgroundImageUI();
        console.log('✅ 背景图片UI更新完成');
      } else {
        console.warn('⚠️ updateBackgroundImageUI 函数不存在');
      }

      // 5. 更新背景图片预览
      if (typeof showCurrentBackgroundPreview === 'function') {
        console.log('🔄 更新背景图片预览...');
        showCurrentBackgroundPreview();
        console.log('✅ 背景图片预览更新完成');
      } else {
        console.warn('⚠️ showCurrentBackgroundPreview 函数不存在');
      }

      // 6. 刷新快捷方式数据
      if (typeof storageManager !== 'undefined' && storageManager.init) {
        console.log('🔄 重新加载快捷方式数据...');
        await storageManager.init();
        console.log('✅ 快捷方式数据加载完成');
      } else {
        console.log('🔄 重新加载快捷方式数据（统一数据管理器）...');
        await window.unifiedDataManager.loadCurrentConfigData();
        console.log('✅ 快捷方式数据加载完成');
      }

      // 7. 重新渲染快捷方式
      if (typeof categoryManager !== 'undefined' && categoryManager.renderCategories) {
        console.log('🔄 通过categoryManager重新渲染快捷方式...');
        await categoryManager.renderCategories();
        console.log('✅ 快捷方式渲染完成（通过categoryManager）');
      } else if (typeof renderCategories === 'function') {
        console.log('🔄 重新渲染快捷方式（备选方案）...');
        renderCategories();
        console.log('✅ 快捷方式渲染完成');
      } else {
        console.warn('⚠️ categoryManager 和 renderCategories 函数都不存在');
      }



      // 8. 关闭可能打开的下拉菜单
      const dropdown = document.querySelector('.config-dropdown');
      if (dropdown) {
        dropdown.classList.remove('open');
        console.log('✅ 下拉菜单已关闭');
      }

      console.log('✅ 配置数据刷新完成');
    } catch (error) {
      console.error('❌ 配置数据刷新失败:', error);
      throw error;
    }
  }

  /**
   * 打开同步模态框
   */
  openSyncModal() {
    if (typeof syncUIManager !== 'undefined') {
      syncUIManager.openSyncModal();
    }
  }

  /**
   * 打开新建配置模态框
   */
  openNewConfigModal() {
    if (!this.newConfigModal) return;

    // 重置表单
    const form = document.getElementById('new-config-form');
    if (form) form.reset();

    this.newConfigModal.style.display = 'flex';
    this.newConfigModal.offsetHeight;
    this.newConfigModal.classList.add('show');
  }

  /**
   * 关闭新建配置模态框
   */
  closeNewConfigModal() {
    if (!this.newConfigModal) return;

    this.newConfigModal.classList.remove('show');
    setTimeout(() => {
      this.newConfigModal.style.display = 'none';
    }, 300);
  }

  /**
   * 创建新配置 - 旁路缓存模式
   */
  async createNewConfig(event) {
    event.preventDefault();

    const createBtn = document.getElementById('create-config-btn');
    const originalText = createBtn.textContent;

    try {
      createBtn.textContent = '创建中...';
      createBtn.disabled = true;

      const formData = {
        displayName: document.getElementById('new-config-name').value.trim(),
        userId: document.getElementById('new-config-user-id').value.trim()
      };

      console.log('开始创建新配置（旁路缓存模式）:', formData);

      // 检查配置是否已存在
      if (themeConfigManager.configExists(formData.userId)) {
        throw new Error('该用户标识已存在');
      }

      // 1. 创建新配置并保存到主存储（Supabase）
      const newConfig = await themeConfigManager.addConfig(formData);
      console.log('新配置已创建:', newConfig);

      // 2. 清除Chrome Storage缓存，确保下次读取最新数据
      await syncManager.clearChromeStorageCache();
      console.log('Chrome Storage缓存已清除');

      // 3. 直接切换到新配置（使用动态配置切换）
      const dynamicConfig = {
        id: newConfig.userId,
        displayName: newConfig.displayName,
        userId: newConfig.userId,
        supabaseUrl: supabaseClient.config?.url,
        supabaseKey: supabaseClient.config?.anonKey,
        isActive: false,
        isDefault: false,
        createdAt: new Date().toISOString()
      };

      console.log('准备切换到新创建的配置:', dynamicConfig);
      await this.switchToDynamicConfig(dynamicConfig);

      // 4. 刷新当前配置的所有数据和UI
      console.log('🔄 开始刷新新配置的数据...');
      await this.refreshCurrentConfiguration();
      console.log('🔄 新配置数据刷新完成');

      this.closeNewConfigModal();
      this.showMessage('配置创建并切换成功！', 'success');
    } catch (error) {
      console.error('创建配置失败:', error);
      this.showMessage(`创建配置失败: ${error.message}`, 'error');
    } finally {
      createBtn.textContent = originalText;
      createBtn.disabled = false;
    }
  }

  /**
   * 显示消息
   */
  showMessage(message, type = 'info') {
    // 创建消息元素
    const messageEl = document.createElement('div');
    messageEl.className = `sync-message ${type}`;
    messageEl.textContent = message;

    // 添加到背景设置模态框
    const bgModal = document.getElementById('bg-modal');
    const modalBody = bgModal ? bgModal.querySelector('.modal-body') : null;

    if (modalBody) {
      modalBody.insertBefore(messageEl, modalBody.firstChild);

      // 3秒后自动移除
      setTimeout(() => {
        if (messageEl.parentNode) {
          messageEl.parentNode.removeChild(messageEl);
        }
      }, 3000);
    }
  }

  /**
   * 打开配置管理模态框
   */
  async openConfigManagementModal() {
    if (!this.configManagementModal) return;

    // 立即显示模态框，提供即时响应
    this.configManagementModal.style.display = 'flex';
    this.configManagementModal.offsetHeight;
    this.configManagementModal.classList.add('show');

    // 绑定模态框事件
    this.bindConfigManagementEvents();

    // 显示加载状态
    this.showConfigListLoading();

    // 异步加载配置列表
    try {
      await this.loadConfigList();
    } catch (error) {
      console.error('加载配置列表失败:', error);
      this.showConfigListError();
    }
  }

  /**
   * 关闭配置管理模态框
   */
  closeConfigManagementModal() {
    if (!this.configManagementModal) return;

    this.configManagementModal.classList.remove('show');
    setTimeout(() => {
      this.configManagementModal.style.display = 'none';
    }, 300);
  }

  /**
   * 显示配置列表加载状态
   */
  showConfigListLoading() {
    const configList = document.getElementById('config-list');
    const configEmpty = document.getElementById('config-empty');

    if (configList) {
      configList.innerHTML = `
        <div class="config-loading">
          <div class="loading-spinner"></div>
          <div class="loading-text">正在加载配置列表...</div>
        </div>
      `;
      configList.style.display = 'block';
    }

    if (configEmpty) {
      configEmpty.style.display = 'none';
    }
  }

  /**
   * 显示配置列表错误状态
   */
  showConfigListError() {
    const configList = document.getElementById('config-list');

    if (configList) {
      configList.innerHTML = `
        <div class="config-error">
          <div class="error-icon">⚠️</div>
          <div class="error-text">加载配置列表失败</div>
          <button class="retry-btn" onclick="themeConfigUIManager.loadConfigList()">重试</button>
        </div>
      `;
      configList.style.display = 'block';
    }
  }

  /**
   * 绑定配置管理模态框事件
   */
  bindConfigManagementEvents() {
    // 避免重复绑定
    if (this.configManagementModal.dataset.eventsBound) return;
    this.configManagementModal.dataset.eventsBound = 'true';

    // 关闭按钮
    const closeButtons = this.configManagementModal.querySelectorAll('.close-modal');
    closeButtons.forEach(btn => {
      btn.addEventListener('click', () => this.closeConfigManagementModal());
    });

    // 点击外部关闭
    this.configManagementModal.addEventListener('click', (e) => {
      if (e.target === this.configManagementModal) {
        this.closeConfigManagementModal();
      }
    });

    // 搜索功能
    const searchInput = document.getElementById('config-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.handleConfigSearch(e.target.value));
    }

    // 排序功能
    const sortSelect = document.getElementById('config-sort');
    if (sortSelect) {
      // 设置默认排序值
      sortSelect.value = this.sortBy;
      sortSelect.addEventListener('change', (e) => this.handleConfigSort(e.target.value));
    }

    // 每页数量选择
    const pageSizeSelect = document.getElementById('page-size-select');
    if (pageSizeSelect) {
      // 设置默认每页数量
      pageSizeSelect.value = this.pagination.pageSize.toString();
      pageSizeSelect.addEventListener('change', (e) => this.handlePageSizeChange(parseInt(e.target.value)));
    }

    // 新建配置按钮
    const newConfigBtnMain = document.getElementById('new-config-btn-main');
    if (newConfigBtnMain) {
      newConfigBtnMain.addEventListener('click', () => {
        this.closeConfigManagementModal();
        this.openNewConfigModal();
      });
    }

    // 空状态下的创建配置按钮
    const createConfigBtn = document.getElementById('create-config-btn');
    if (createConfigBtn) {
      createConfigBtn.addEventListener('click', () => {
        this.openNewConfigModal();
      });
    }
  }

  /**
   * 加载配置列表 - 支持分页查询
   */
  async loadConfigList(resetPage = false) {
    try {
      if (resetPage) {
        this.pagination.currentPage = 1;
      }

      if (typeof syncManager !== 'undefined' && syncManager.isSupabaseEnabled) {
        // 启用Supabase：使用分页查询
        await this.loadConfigListFromSupabaseWithPagination();
      } else {
        // 未启用Supabase：使用本地数据（模拟分页）
        await this.loadConfigListFromLocal();
      }

      this.renderConfigList();

    } catch (error) {
      console.error('ThemeConfigUI: 加载配置列表失败:', error);
      // 降级：使用本地数据
      await this.loadConfigListFromLocal();
      this.renderConfigList();
    }
  }

  /**
   * 从Supabase分页加载配置列表
   */
  async loadConfigListFromSupabaseWithPagination() {
    try {
      console.log('ThemeConfigUI: 分页查询Supabase配置列表', {
        page: this.pagination.currentPage,
        pageSize: this.pagination.pageSize,
        sortBy: this.sortBy
      });

      // 获取总数
      const supabaseClient = this.getSupabaseClient();
      const totalCount = await supabaseClient.getDataCount();
      this.pagination.totalCount = totalCount;
      this.pagination.totalPages = Math.ceil(totalCount / this.pagination.pageSize);

      // 确定排序字段
      let orderBy = 'updated_at';
      let ascending = false;

      if (this.sortBy === 'name') {
        orderBy = 'user_id';
        ascending = true;
      } else if (this.sortBy === 'created') {
        orderBy = 'created_at';
        ascending = false;
      }

      // 分页查询数据
      const pageData = await supabaseClient.getDataWithPagination(
        this.pagination.currentPage,
        this.pagination.pageSize,
        orderBy,
        ascending
      );

      console.log('ThemeConfigUI: 分页数据:', pageData);

      this.currentConfigs = [];

      // 遍历分页数据，提取配置信息
      if (pageData && Array.isArray(pageData)) {
        pageData.forEach(userData => {
          if (userData && userData.data) {
            // 为每个用户创建一个配置项
            const config = {
              id: userData.user_id,
              displayName: `用户 ${userData.user_id} 的配置`,
              userId: userData.user_id,
              supabaseUrl: '', // 这些信息在数据中没有，需要从当前连接获取
              supabaseKey: '',
              isActive: userData.user_id === supabaseClient.userId, // 当前用户的配置标记为活跃
              isDefault: userData.user_id === 'default',
              createdAt: userData.created_at,
              lastModified: userData.updated_at,
              lastSync: userData.updated_at,
              shortcutCount: userData.data.categories ?
                userData.data.categories.reduce((total, cat) => total + (cat.shortcuts?.length || 0), 0) : 0
            };

            this.currentConfigs.push(config);
          }
        });

        console.log('ThemeConfigUI: 分页配置列表构建完成', {
          currentPage: this.pagination.currentPage,
          pageSize: this.pagination.pageSize,
          totalCount: this.pagination.totalCount,
          totalPages: this.pagination.totalPages,
          configsInPage: this.currentConfigs.length
        });
      }

      // 应用搜索过滤
      this.applySearchFilter();

    } catch (error) {
      console.error('ThemeConfigUI: 从Supabase分页加载配置列表失败:', error);
      throw error;
    }
  }

  /**
   * 从本地加载配置列表（模拟分页）
   */
  async loadConfigListFromLocal() {
    try {
      console.log('ThemeConfigUI: 从本地加载配置列表');

      const allConfigs = window.unifiedDataManager.getAllConfigs();

      // 应用排序
      this.sortConfigs(allConfigs);

      // 计算分页
      this.pagination.totalCount = allConfigs.length;
      this.pagination.totalPages = Math.ceil(allConfigs.length / this.pagination.pageSize);

      // 获取当前页数据
      const startIndex = (this.pagination.currentPage - 1) * this.pagination.pageSize;
      const endIndex = startIndex + this.pagination.pageSize;
      this.currentConfigs = allConfigs.slice(startIndex, endIndex);

      console.log('ThemeConfigUI: 本地分页配置列表构建完成', {
        currentPage: this.pagination.currentPage,
        pageSize: this.pagination.pageSize,
        totalCount: this.pagination.totalCount,
        totalPages: this.pagination.totalPages,
        configsInPage: this.currentConfigs.length
      });

      // 应用搜索过滤
      this.applySearchFilter();

    } catch (error) {
      console.error('ThemeConfigUI: 从本地加载配置列表失败:', error);
      this.currentConfigs = [];
      this.filteredConfigs = [];
    }
  }

  /**
   * 强制刷新配置列表（直接从Supabase重新获取）
   */
  async forceRefreshConfigList() {
    try {
      console.log('ThemeConfigUI: 强制刷新配置列表');

      // 清空当前配置缓存
      this.currentConfigs = [];
      this.filteredConfigs = [];

      // 直接重新加载配置列表（会从Supabase获取最新数据）
      await this.loadConfigList();

      console.log('ThemeConfigUI: 配置列表强制刷新完成');
    } catch (error) {
      console.error('ThemeConfigUI: 强制刷新失败:', error);
    }
  }

  /**
   * 处理配置导入后的UI刷新
   */
  async handleConfigurationImported() {
    try {
      // 1. 重新加载配置数据
      await window.unifiedDataManager.loadCurrentConfigData();

      // 2. 强制刷新配置列表
      await this.forceRefreshConfigList();

      // 3. 更新配置选择器
      await this.updateConfigSelector();

      // 4. 更新配置切换显示
      await this.updateConfigSwitchDisplay();
    } catch (error) {
      console.error('ThemeConfigUI: 配置导入后UI刷新失败:', error);
    }
  }

  /**
   * 渲染配置列表
   */
  renderConfigList() {
    const configList = document.getElementById('config-list');
    const configEmpty = document.getElementById('config-empty');

    if (!configList || !configEmpty) return;

    if (this.filteredConfigs.length === 0) {
      configList.style.display = 'none';
      configEmpty.style.display = 'block';
      this.renderPagination();
      return;
    }

    configList.style.display = 'block';
    configEmpty.style.display = 'none';

    configList.innerHTML = this.filteredConfigs.map(config => this.createConfigCard(config)).join('');

    // 绑定配置卡片事件
    this.bindConfigCardEvents();

    // 渲染分页控件
    this.renderPagination();
  }

  /**
   * 创建配置卡片HTML
   */
  createConfigCard(config) {
    const isActive = config.isActive;
    const isDefault = config.isDefault || config.id === 'default';
    const shortcutCount = config.shortcutCount || 0;

    // 显示最后修改时间而不是同步时间
    const lastModified = config.lastModified ? this.formatTime(config.lastModified) :
                        (config.createdAt ? this.formatTime(config.createdAt) : '未知');

    return `
      <div class="config-card ${isActive ? 'active' : ''}" data-config-id="${config.id}">
        <div class="config-card-header">
          <div class="config-info">
            <div class="config-name">
              ${config.displayName}
              ${isActive ? '<span class="config-badge">当前</span>' : ''}
              ${isDefault ? '<span class="config-badge" style="background: #28a745;">默认</span>' : ''}
              ${config.isTemporary ? '<span class="config-badge" style="background: #ffa500;">临时</span>' : ''}
            </div>
            <div class="config-user">👤 ${config.userId || 'default'}</div>
          </div>
        </div>
        <div class="config-meta">
          <div class="config-meta-item">
            <span>🕒</span>
            <span>更新于 ${lastModified}</span>
          </div>
          <div class="config-meta-item">
            <span>📊</span>
            <span>${shortcutCount} 个快捷方式</span>
          </div>
          <div class="config-meta-item">
            <span>📅</span>
            <span>创建于 ${config.createdAt ? this.formatTime(config.createdAt) : '未知'}</span>
          </div>
        </div>
        <div class="config-actions-row">
          ${!isActive ? `<button class="config-btn primary" data-action="switch" data-config-id="${config.id}">切换</button>` : ''}
          ${!config.isTemporary && !isDefault ? `<button class="config-btn" data-action="edit" data-config-id="${config.id}">编辑</button>` : ''}
          ${!config.isTemporary ? `<button class="config-btn" data-action="export" data-config-id="${config.id}">导出</button>` : ''}
          ${!isActive && !config.isTemporary && !isDefault ? `<button class="config-btn danger" data-action="delete" data-config-id="${config.id}">删除</button>` : ''}
          ${config.isTemporary ? `<button class="config-btn primary" data-action="save-temp" data-config-id="${config.id}">保存配置</button>` : ''}
        </div>
      </div>
    `;
  }



  /**
   * 应用搜索过滤
   */
  applySearchFilter() {
    if (this.searchTerm === '') {
      this.filteredConfigs = [...this.currentConfigs];
    } else {
      const term = this.searchTerm.toLowerCase().trim();
      this.filteredConfigs = this.currentConfigs.filter(config =>
        config.displayName.toLowerCase().includes(term) ||
        config.userId.toLowerCase().includes(term)
      );
    }
  }

  /**
   * 处理配置搜索
   */
  handleConfigSearch(searchTerm) {
    this.searchTerm = searchTerm;

    // 搜索时重置到第一页
    this.pagination.currentPage = 1;

    // 重新加载数据
    this.loadConfigList();
  }

  /**
   * 排序配置列表
   */
  sortConfigs(configs) {
    switch (this.sortBy) {
      case 'name':
        configs.sort((a, b) => a.displayName.localeCompare(b.displayName));
        break;
      case 'recent':
        configs.sort((a, b) => {
          const aTime = a.lastModified || a.lastSync || a.createdAt;
          const bTime = b.lastModified || b.lastSync || b.createdAt;
          return new Date(bTime) - new Date(aTime);
        });
        break;
      case 'created':
        configs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
    }
  }

  /**
   * 处理配置排序
   */
  handleConfigSort(sortType) {
    this.sortBy = sortType;

    // 排序时重置到第一页
    this.pagination.currentPage = 1;

    // 重新加载数据
    this.loadConfigList();
  }

  /**
   * 渲染分页控件
   */
  renderPagination() {
    const paginationContainer = document.getElementById('config-pagination');
    if (!paginationContainer) {
      console.warn('ThemeConfigUI: 分页容器未找到');
      return;
    }

    // 分页状态日志（仅在开发模式下显示）
    if (window.location.hostname === 'localhost' || window.location.protocol === 'file:') {
      console.log('ThemeConfigUI: 渲染分页控件', {
        totalCount: this.pagination.totalCount,
        totalPages: this.pagination.totalPages,
        currentPage: this.pagination.currentPage,
        pageSize: this.pagination.pageSize,
        filteredConfigsLength: this.filteredConfigs.length
      });
    }

    // 如果总页数小于等于1，隐藏分页控件
    if (this.pagination.totalPages <= 1) {
      paginationContainer.style.display = 'none';
      return;
    }

    paginationContainer.style.display = 'flex';

    const { currentPage, totalPages, totalCount } = this.pagination;

    // 确保至少显示基本信息
    const actualTotalPages = Math.max(1, totalPages);
    const actualCurrentPage = Math.min(currentPage, actualTotalPages);

    // 计算显示的页码范围
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    // 调整起始页，确保显示足够的页码
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // 计算当前页显示的记录范围
    const startRecord = (actualCurrentPage - 1) * this.pagination.pageSize + 1;
    const endRecord = Math.min(actualCurrentPage * this.pagination.pageSize, totalCount);

    let paginationHTML = `
      <div class="pagination-info">
        显示第 ${startRecord}-${endRecord} 条，共 ${totalCount} 个配置
      </div>
      <div class="pagination-controls">
    `;

    // 上一页按钮
    paginationHTML += `
      <button class="pagination-btn ${currentPage === 1 ? 'disabled' : ''}"
              data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>
        上一页
      </button>
    `;

    // 第一页
    if (startPage > 1) {
      paginationHTML += `<button class="pagination-btn" data-page="1">1</button>`;
      if (startPage > 2) {
        paginationHTML += `<span class="pagination-ellipsis">...</span>`;
      }
    }

    // 页码按钮
    for (let i = startPage; i <= endPage; i++) {
      paginationHTML += `
        <button class="pagination-btn ${i === currentPage ? 'active' : ''}"
                data-page="${i}">${i}</button>
      `;
    }

    // 最后一页
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        paginationHTML += `<span class="pagination-ellipsis">...</span>`;
      }
      paginationHTML += `<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
    }

    // 下一页按钮
    paginationHTML += `
      <button class="pagination-btn ${currentPage === totalPages ? 'disabled' : ''}"
              data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>
        下一页
      </button>
    `;

    paginationHTML += `</div>`;

    paginationContainer.innerHTML = paginationHTML;

    // 绑定分页事件
    this.bindPaginationEvents();
  }

  /**
   * 绑定分页事件
   */
  bindPaginationEvents() {
    const paginationContainer = document.getElementById('config-pagination');
    if (!paginationContainer) return;

    paginationContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('pagination-btn') && !e.target.disabled) {
        const page = parseInt(e.target.dataset.page);
        if (page && page !== this.pagination.currentPage) {
          this.goToPage(page);
        }
      }
    });
  }

  /**
   * 跳转到指定页
   */
  goToPage(page) {
    if (page < 1 || page > this.pagination.totalPages) return;

    this.pagination.currentPage = page;
    this.loadConfigList();
  }

  /**
   * 处理每页数量变化
   */
  handlePageSizeChange(newPageSize) {
    console.log('ThemeConfigUI: 每页数量变更为:', newPageSize);

    // 计算当前显示的第一条记录的索引
    const currentFirstIndex = (this.pagination.currentPage - 1) * this.pagination.pageSize;

    // 更新每页数量
    this.pagination.pageSize = newPageSize;

    // 计算新的页码，尽量保持当前显示的内容
    this.pagination.currentPage = Math.floor(currentFirstIndex / newPageSize) + 1;

    // 保存用户的分页设置
    this.savePaginationSettings();

    // 重新加载数据
    this.loadConfigList();
  }

  /**
   * 加载分页设置
   */
  async loadPaginationSettings() {
    try {
      if (chrome && chrome.storage && chrome.storage.local) {
        const result = await new Promise((resolve) => {
          chrome.storage.local.get(['configPaginationSettings'], resolve);
        });

        if (result.configPaginationSettings) {
          this.pagination.pageSize = result.configPaginationSettings.pageSize || 10;
        }
      }
    } catch (error) {
      console.warn('ThemeConfigUI: 加载分页设置失败:', error);
    }
  }

  /**
   * 保存分页设置
   */
  async savePaginationSettings() {
    try {
      if (chrome && chrome.storage && chrome.storage.local) {
        await new Promise((resolve) => {
          chrome.storage.local.set({
            configPaginationSettings: {
              pageSize: this.pagination.pageSize
            }
          }, resolve);
        });
      }
    } catch (error) {
      console.warn('ThemeConfigUI: 保存分页设置失败:', error);
    }
  }

  /**
   * 绑定配置卡片事件
   */
  bindConfigCardEvents() {
    const configList = document.getElementById('config-list');
    if (!configList) return;

    // 移除之前的事件监听器（如果存在）
    if (this.configListClickHandler) {
      configList.removeEventListener('click', this.configListClickHandler);
    }

    // 创建新的事件处理器
    this.configListClickHandler = (e) => {
      const button = e.target.closest('.config-btn');
      if (!button) return;

      const action = button.dataset.action;
      const configId = button.dataset.configId;

      if (!action || !configId) return;

      // 防止重复点击
      if (button.disabled) return;

      switch (action) {
        case 'switch':
          this.switchToConfigFromManagement(configId);
          break;
        case 'edit':
          this.editConfig(configId);
          break;
        case 'export':
          this.exportConfig(configId);
          break;
        case 'delete':
          this.deleteConfig(configId);
          break;
        case 'save-temp':
          this.saveTemporaryConfig(configId);
          break;
        default:
          console.warn('未知的配置操作:', action);
      }
    };

    // 绑定新的事件监听器
    configList.addEventListener('click', this.configListClickHandler);
  }

  /**
   * 从配置管理界面切换配置
   */
  async switchToConfigFromManagement(configId) {
    try {
      await this.switchToConfig(configId);
      this.closeConfigManagementModal();
      this.showMessage('配置切换成功！', 'success');
    } catch (error) {
      console.error('切换配置失败:', error);
      this.showMessage(`切换配置失败: ${error.message}`, 'error');
    }
  }

  /**
   * 编辑配置
   */
  async editConfig(configId) {
    const config = this.currentConfigs.find(c => c.id === configId);
    if (!config) return;

    this.currentEditingConfigId = configId;

    // 填充编辑表单
    const nameInput = document.getElementById('edit-config-name');
    const userIdInput = document.getElementById('edit-config-user-id');

    if (nameInput) nameInput.value = config.displayName;
    if (userIdInput) userIdInput.value = config.userId;

    // 关闭配置管理模态框，打开编辑模态框
    this.closeConfigManagementModal();
    this.openEditConfigModal();
  }

  /**
   * 打开编辑配置模态框
   */
  openEditConfigModal() {
    if (!this.editConfigModal) return;

    this.editConfigModal.style.display = 'flex';
    this.editConfigModal.offsetHeight;
    this.editConfigModal.classList.add('show');

    // 绑定编辑模态框事件
    this.bindEditConfigEvents();
  }

  /**
   * 关闭编辑配置模态框
   */
  closeEditConfigModal() {
    if (!this.editConfigModal) return;

    this.editConfigModal.classList.remove('show');
    setTimeout(() => {
      this.editConfigModal.style.display = 'none';
    }, 300);

    this.currentEditingConfigId = null;
  }

  /**
   * 绑定编辑配置模态框事件
   */
  bindEditConfigEvents() {
    // 避免重复绑定
    if (this.editConfigModal.dataset.eventsBound) return;
    this.editConfigModal.dataset.eventsBound = 'true';

    // 关闭按钮
    const closeButtons = this.editConfigModal.querySelectorAll('.close-modal');
    closeButtons.forEach(btn => {
      btn.addEventListener('click', () => this.closeEditConfigModal());
    });

    // 取消按钮
    const cancelBtn = document.getElementById('cancel-edit-config-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.closeEditConfigModal());
    }

    // 表单提交
    const form = document.getElementById('edit-config-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleEditConfigSubmit(e));
    }

    // 点击外部关闭
    this.editConfigModal.addEventListener('click', (e) => {
      if (e.target === this.editConfigModal) {
        this.closeEditConfigModal();
      }
    });
  }

  /**
   * 处理编辑配置提交
   */
  async handleEditConfigSubmit(event) {
    event.preventDefault();

    if (!this.currentEditingConfigId) return;

    const saveBtn = document.getElementById('save-edit-config-btn');
    const originalText = saveBtn.textContent;

    try {
      saveBtn.textContent = '保存中...';
      saveBtn.disabled = true;

      const newName = document.getElementById('edit-config-name').value.trim();

      if (!newName) {
        throw new Error('配置名称不能为空');
      }

      // 更新配置
      await themeConfigManager.updateConfig(this.currentEditingConfigId, {
        displayName: newName
      });

      this.closeEditConfigModal();
      this.showMessage('配置更新成功！', 'success');

      // 更新UI显示
      await this.updateConfigSelector();
    } catch (error) {
      console.error('更新配置失败:', error);
      this.showMessage(`更新配置失败: ${error.message}`, 'error');
    } finally {
      saveBtn.textContent = originalText;
      saveBtn.disabled = false;
    }
  }

  /**
   * 删除配置 - 支持动态配置和传统配置
   */
  async deleteConfig(configId) {
    const config = this.currentConfigs.find(c => c.id === configId);
    if (!config) {
      console.error('配置不存在:', configId);
      this.showMessage('配置不存在', 'error');
      return;
    }

    // 检查是否是当前配置
    const currentConfig = window.unifiedDataManager.getCurrentConfig();
    if (currentConfig.configId === configId) {
      this.showMessage('不能删除当前正在使用的配置，请先切换到其他配置', 'error');
      return;
    }

    if (!confirm(`确定要删除配置 "${config.displayName}" 吗？此操作不可撤销。`)) {
      return;
    }

    try {
      // 使用统一数据管理器删除配置
      console.log('删除配置:', config);
      console.log('配置ID:', configId);
      await window.unifiedDataManager.deleteConfig(configId);

      this.showMessage('配置删除成功！', 'success');

      // 重新加载配置列表
      await this.loadConfigList();

      // 更新UI显示
      await this.updateConfigSelector();
    } catch (error) {
      console.error('删除配置失败:', error);
      this.showMessage(`删除配置失败: ${error.message}`, 'error');
    }
  }

  /**
   * 删除动态配置（直接删除Supabase中的用户数据）
   */
  async deleteDynamicConfig(config) {
    try {
      console.log('开始删除动态配置的Supabase数据:', config.userId);

      // 获取正确的 Supabase 客户端和配置信息
      const supabaseClient = this.getSupabaseClient();

      // 从存储中获取当前 Supabase 配置
      const result = await new Promise((resolve) => {
        chrome.storage.sync.get(['supabase_config'], resolve);
      });
      const currentConfig = result.supabase_config;

      if (!currentConfig || !currentConfig.url || !currentConfig.anonKey) {
        throw new Error('无法获取 Supabase 配置信息');
      }

      // 临时切换到目标用户进行删除操作
      await supabaseClient.initialize({
        url: currentConfig.url,
        anonKey: currentConfig.anonKey,
        userId: config.userId
      });

      // 删除Supabase中的用户数据
      await supabaseClient.deleteData();
      console.log('动态配置的Supabase数据已删除');

      // 恢复到原来的连接
      const currentUser = window.unifiedDataManager.getCurrentConfig();
      if (currentUser && currentUser.type === 'supabase') {
        await supabaseClient.initialize({
          url: currentConfig.url,
          anonKey: currentConfig.anonKey,
          userId: currentUser.userId
        });
        console.log('已恢复到原始Supabase连接');
      }

    } catch (error) {
      console.error('删除动态配置失败:', error);
      throw error;
    }
  }

  /**
   * 导出配置
   */
  async exportConfig(configId) {
    try {
      const config = this.currentConfigs.find(c => c.id === configId);
      if (!config) return;

      const exportData = {
        displayName: config.displayName,
        userId: config.userId,
        supabaseUrl: config.supabaseUrl,
        supabaseKey: config.supabaseKey,
        exportTime: new Date().toISOString()
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });

      const link = document.createElement('a');
      link.href = URL.createObjectURL(dataBlob);
      link.download = `card-tab-config-${config.displayName}-${new Date().toISOString().split('T')[0]}.json`;
      link.click();

      this.showMessage('配置导出成功！', 'success');
    } catch (error) {
      console.error('导出配置失败:', error);
      this.showMessage(`导出配置失败: ${error.message}`, 'error');
    }
  }

  /**
   * 保存临时配置
   */
  async saveTemporaryConfig(configId) {
    try {
      const tempConfig = this.filteredConfigs.find(c => c.id === configId);
      if (!tempConfig) return;

      const displayName = prompt('请输入配置名称:', '我的配置');
      if (!displayName) return;

      // 创建新配置
      const newConfig = await themeConfigManager.addConfig({
        displayName: displayName.trim(),
        userId: tempConfig.userId,
        supabaseUrl: tempConfig.supabaseUrl,
        supabaseKey: tempConfig.supabaseKey
      });

      this.showMessage('配置保存成功！', 'success');

      // 重新加载配置列表
      await this.loadConfigList();
    } catch (error) {
      console.error('保存配置失败:', error);
      this.showMessage(`保存配置失败: ${error.message}`, 'error');
    }
  }

  /**
   * 格式化时间显示
   */
  formatTime(timeString) {
    if (!timeString) return '未知';

    const time = new Date(timeString);
    const now = new Date();
    const diff = now - time;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;

    return time.toLocaleDateString();
  }
}

// 创建全局实例
const themeConfigUIManager = new ThemeConfigUIManager();
window.themeConfigUIManager = themeConfigUIManager;

// 创建全局配置刷新函数
window.refreshCurrentConfiguration = async function() {
  if (window.themeConfigUIManager && window.themeConfigUIManager.refreshCurrentConfiguration) {
    return await window.themeConfigUIManager.refreshCurrentConfiguration();
  } else {
    console.warn('配置刷新管理器未初始化');
  }
};


