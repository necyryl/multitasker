boot: {
    ready: 'Hermes Desktop готовий',
    desktopBootFailedWithMessage: message => `Запуск робочого столу не вдався: ${message}`,
    steps: {
      connectingGateway: 'Підключення до шлюзу реального часу',
      loadingSettings: 'Завантаження налаштувань Hermes',
      loadingSessions: 'Завантаження нещодавніх сеансів',
      startingDesktopConnection: 'Встановлення з’єднання робочого столу',
      startingHermesDesktop: 'Запуск Hermes Desktop…'
    },
    errors: {
      backgroundExited: 'Фоновий процес Hermes завершено.',
      backgroundExitedDuringStartup: 'Фоновий процес Hermes завершено під час запуску.',
      backendStopped: 'Backend зупинено',
      desktopBootFailed: 'Запуск робочого столу не вдався',
      gatewaySignInRequired: 'Потрібно увійти в шлюз',
      ipcBridgeUnavailable: 'Міст IPC для робочого столу недоступний.'
    },
    failure: {
      title: "Hermes не може запуститися",
      description:
        "Фоновий шлюз не запущено. Спробуйте один із способів відновлення нижче. Тут нічого не видаляється з ваших чатів або налаштувань.",
      remoteTitle: 'Потрібно увійти в віддалений шлюз',
      remoteDescription:
        'Ваш сеанс віддаленого шлюзу завершився. Увійдіть ще раз, щоб підключитися. Тут нічого не видаляється з ваших чатів або налаштувань.',
      retry: 'Спробувати ще раз',
      repairInstall: 'Відновити встановлення',
      useLocalGateway: 'Використовувати локальний шлюз',
      openLogs: 'Відкрити журнали',
      repairHint: 'Відновлення повторно запускає інсталятор і може зайняти кілька хвилин на новому пристрої.',
      remoteSignInHint: 'Відкриває вікно входу в шлюз. Використовуйте локальний шлюз, щоб переключитися на вбудований backend.',
      hideRecentLogs: 'Приховати нещодавні журнали',
      showRecentLogs: 'Показати нещодавні журнали',
      signedInTitle: 'Увійшло успішно',
      signedInMessage: 'Відновлення з’єднання з віддаленим шлюзом…',
      signInIncompleteTitle: 'Вхід не завершено',
      signInIncompleteMessage: 'Вікно входу було закрито до завершення аутентифікації.',
      signInFailed: 'Не вдалося увійти',
      signInToRemoteGateway: 'Увійдіть у віддалений шлюз',
      signInWithProvider: provider => `Увійти через ${provider}`,
      identityProvider: 'вашого провайдера ідентифікації'
    }
  },
