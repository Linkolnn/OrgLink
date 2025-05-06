// Хранилище для управления контекстным меню
import { defineStore } from 'pinia';

export const useContextMenuStore = defineStore('contextMenu', {
  state: () => ({
    activeMenuId: null,
  }),
  
  actions: {
    // Открыть меню для конкретного сообщения
    openMenu(messageId) {
      this.activeMenuId = messageId;
    },
    
    // Закрыть активное меню
    closeMenu() {
      this.activeMenuId = null;
    },
    
    // Проверить, активно ли меню для конкретного сообщения
    isMenuActive(messageId) {
      return this.activeMenuId === messageId;
    }
  }
});
