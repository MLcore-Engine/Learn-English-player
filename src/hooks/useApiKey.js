import { useState, useEffect, useCallback } from 'react';
import { useApiKey as useApiKeyContext } from '../contexts/AppContext';
import aiService from '../utils/aiService';

/**
 * API Key管理钩子
 * 处理与API Key相关的所有逻辑，包括获取、保存和状态管理
 */
export const useApiKey = () => {
  // 使用来自Context的状态和actions
  const { 
    apiKey, 
    showInput, 
    status, 
    setApiKey, 
    setShowInput, 
    setStatus 
  } = useApiKeyContext();

  // 获取API Key的函数
  const fetchApiKey = useCallback(async () => {
    if (!window.electronAPI) return;
    
    // 使用函数形式设置状态
    setStatus(() => '正在获取...');
    try {
      const result = await window.electronAPI.invoke('getApiKey');
      if (result.success) {
        setStatus(() => result.apiKey ? '已设置' : '未设置');
        // 设置到aiService中
        if (aiService && typeof aiService.setApiKey === 'function') {
          aiService.setApiKey(result.apiKey || '');
        }
      } else {
        setStatus(() => `获取失败: ${result.error}`);
      }
    } catch (error) {
      setStatus(() => `获取错误: ${error.message}`);
    }
  }, []); // 移除依赖

  // 保存API Key的函数
  const saveApiKey = useCallback(async () => {
    if (!window.electronAPI) return;
    
    try {
      const result = await window.electronAPI.invoke('saveApiKey', apiKey);
      if (result.success) {
        alert('API Key 保存成功！');
        setApiKey('');
        setShowInput(false);
        fetchApiKey();
        return true;
      } else {
        alert(`保存失败: ${result.error}`);
        return false;
      }
    } catch (error) {
      alert(`保存错误: ${error.message}`);
      return false;
    }
  }, [apiKey, setApiKey, setShowInput, fetchApiKey]);

  // 只在组件首次挂载时执行一次
  useEffect(() => {
    let isMounted = true;
    
    const loadApiKey = async () => {
      if (!window.electronAPI || !isMounted) return;
      
      setStatus('正在获取...');
      try {
        const result = await window.electronAPI.invoke('getApiKey');
        if (isMounted) {
          if (result.success) {
            setStatus(result.apiKey ? '已设置' : '未设置');
            if (aiService && typeof aiService.setApiKey === 'function') {
              aiService.setApiKey(result.apiKey || '');
            }
          } else {
            setStatus(`获取失败: ${result.error}`);
          }
        }
      } catch (error) {
        if (isMounted) {
          setStatus(`获取错误: ${error.message}`);
        }
      }
    };
    
    loadApiKey();
    
    return () => {
      isMounted = false;
    };
  }, []); // 空依赖数组

  // 监听主进程发送的打开API Key设置事件
  useEffect(() => {
    if (!window.electronAPI) return;
    
    const cleanup = window.electronAPI.on('openApiKeySettings', () => {
      fetchApiKey();
      setShowInput(true);
    });
    
    return () => cleanup && cleanup();
  }, [fetchApiKey, setShowInput]);

  return {
    apiKey,
    showInput,
    status,
    setApiKey,
    setShowInput,
    saveApiKey,
    fetchApiKey
  };
};

export default useApiKey; 