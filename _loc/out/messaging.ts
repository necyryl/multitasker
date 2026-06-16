messaging: {
    search: 'Пошук повідомлень...',
    loading: 'Завантаження платформ обміну повідомленнями...',
    loadFailed: 'Не вдалося завантажити платформи обміну повідомленнями',
    states: {
      connected: 'Підключено',
      connecting: 'Встановлення з’єднання',
      disabled: 'Вимкнено',
      fatal: 'Помилка',
      gateway_stopped: 'Шлюз обміну повідомленнями зупинено',
      not_configured: 'Необхідне налаштування',
      pending_restart: 'Потрібен перезапуск',
      retrying: 'Спроба повторного підключення',
      startup_failed: 'Не вдалося запустити'
    },
    unknown: 'Невідомо',
    hintPendingRestart: 'Перезапустіть шлюз зі стрічки стану, щоб застосувати цю зміну.',
    hintGatewayStopped: 'Запустіть шлюз зі стрічки стану для підключення.',
    credentialsSet: 'Дані авторизації встановлено',
    needsSetup: 'Необхідне налаштування',
    gatewayStopped: 'Шлюз обміну повідомленнями зупинено',
    getCredentials: 'Отримайте свої облікові дані',
    openSetupGuide: 'Відкрити посібник з налаштування',
    required: 'Обов’язково',
    recommended: 'Рекомендовано',
    advanced: count => `Додатково (${count})`,
    noTokenNeeded: 'Для цієї платформи не потрібен токен. Використовуйте посібник з налаштування вище, а потім увімкніть її нижче.',
    enabled: 'Увімкнено',
    disabled: 'Вимкнено',
    unsavedChanges: 'Не збережені зміни',
    saving: 'Збереження...',
    saveChanges: 'Зберегти зміни',
    saved: 'Збережено',
    replaceValue: 'Замінити поточне значення',
    openDocs: 'Відкрити документацію',
    clearField: key => `Очистити ${key}`,
    enableAria: name => `Увімкнути ${name}`,
    disableAria: name => `Вимкнути ${name}`,
    platformEnabled: name => `${name} увімкнено`,
    platformDisabled: name => `${name} вимкнено`,
    restartToApply: 'Перезапустіть шлюз, щоб зміни набули чинності.',
    setupSaved: name => `${name} налаштування збережено`,
    restartToReconnect: 'Перезапустіть шлюз для повторного підключення з новими обліковими даними.',
    keyCleared: key => `${key} очищено`,
    setupUpdated: name => `${name} було оновлено.`,
    failedUpdate: name => `Не вдалося оновити ${name}`,
    failedSave: name => `Не вдалося зберегти ${name}`,
    failedClear: key => `Не вдалося очистити ${key}`,
    fieldCopy: {
      TELEGRAM_BOT_TOKEN: {
        label: 'Токен бота',
        help: 'Створіть бота за допомогою @BotFather, а потім вставте токен, який він надасть.',
        placeholder: 'Вставити Telegram bot token'
      },
      TELEGRAM_ALLOWED_USERS: {
        label: 'Дозволені ID користувачів Telegram',
        help: 'Рекомендовано. Числові ID, розділені комами, з @userinfobot. Без цього будь-хто може надіслати повідомлення вашому боту.'
      },
      TELEGRAM_PROXY: { label: 'URL проксі', help: 'Потрібен лише в мережах, де Telegram заблоковано.' },
      DISCORD_BOT_TOKEN: {
        label: 'Токен бота',
        help: 'Створіть додаток на Discord Developer Portal, додайте бота, а потім вставте його токен.'
      },
      DISCORD_ALLOWED_USERS: {
        label: 'Дозволені ID користувачів Discord',
        help: 'Рекомендовано. ID користувачів Discord, розділені комами.'
      },
      DISCORD_REPLY_TO_MODE: { label: 'Стиль відповіді', help: 'first, all, або off.' },
      DISCORD_ALLOW_ALL_USERS: {
        label: 'Дозволити всім користувачам Discord',
        help: 'Лише для розробки. Якщо true, будь-хто може надіслати повідомлення боту без списку дозволених.'
      },
      DISCORD_HOME_CHANNEL: {
        label: 'ID домашнього каналу',
        help: 'Канал, куди бот надсилає проактивні повідомлення (вихід cron, нагадування).'
      },
      DISCORD_HOME_CHANNEL_NAME: {
        label: 'Назва домашнього каналу',
        help: 'Ім’я для домашнього каналу в журналах і вихідних даних статусу.'
      },
      BLUEBUBBLES_ALLOW_ALL_USERS: {
        label: 'Дозволити всім користувачам iMessage',
        help: 'Якщо true, пропустіть список дозволених BlueBubbles.'
      },
      MATTERMOST_ALLOW_ALL_USERS: { label: 'Дозволити всім користувачам Mattermost' },
      MATTERMOST_HOME_CHANNEL: { label: 'Домашній канал' },
      QQ_ALLOW_ALL_USERS: { label: 'Дозволити всім користувачам QQ' },
      QQBOT_HOME_CHANNEL: { label: 'Домашній канал QQ', help: 'Канал або група за замовчуванням для cron доставки.' },
      QQBOT_HOME_CHANNEL_NAME: { label: 'Назва домашнього каналу QQ' },
      SLACK_BOT_TOKEN: {
        label: 'Slack bot token',
        help: 'Використовуйте токен бота з OAuth & Permissions після встановлення вашого Slack додатка.',
        placeholder: 'Вставити Slack bot token'
      },
      SLACK_APP_TOKEN: {
        label: 'Slack app token',
        help: 'Використовуйте токен рівня додатку, необхідний для Socket Mode.',
        placeholder: 'Вставити Slack app token'
      },
      SLACK_ALLOWED_USERS: { label: 'Дозволені ID користувачів Slack', help: 'Рекомендовано. ID користувачів Slack, розділені комами.' },
      MATTERMOST_URL: { label: 'URL сервера', placeholder: 'https://mattermost.example.com' },
      MATTERMOST_TOKEN: { label: 'Токен бота' },
      MATTERMOST_ALLOWED_USERS: {
        label: 'Дозволені ID користувачів',
        help: 'Рекомендовано. ID користувачів Mattermost, розділені комами.'
      },
      MATRIX_HOMESERVER: { label: 'URL homeserver', placeholder: 'https://matrix.org' },
      MATRIX_ACCESS_TOKEN: { label: 'Токен доступу' },
      MATRIX_USER_ID: { label: 'ID бота', placeholder: '@hermes:example.org' },
      MATRIX_ALLOWED_USERS: {
        label: 'Дозволені ID користувачів Matrix',
        help: 'Рекомендовано. ID користувачів у форматі @user:server.'
      },
      SIGNAL_HTTP_URL: {
        label: 'Signal bridge URL',
        placeholder: 'http://127.0.0.1:8080',
        help: 'URL запущеного signal-cli REST bridge.'
      },
      SIGNAL_ACCOUNT: { label: 'Номер телефону', help: 'Номер, зареєстрований у вашому signal-cli bridge.' },
      SIGNAL_ALLOWED_USERS: { label: 'Дозволені користувачі Signal', help: 'Рекомендовано. Користувачі Signal, розділені комами.' },
      WHATSAPP_ENABLED: {
        label: 'Увімкнути WhatsApp bridge',
        help: 'Встановлюється автоматично перемикачем нижче. Залиште без змін, якщо ви не знаєте, що робите.'
      },
      WHATSAPP_MODE: { label: 'Режим мосту' },
      WHATSAPP_ALLOWED_USERS: {
        label: 'Дозволені користувачі WhatsApp',
        help: 'Рекомендовано. Номери телефонів або ID WhatsApp, розділені комами.'
      }
    },
    platformIntro: {}
  },
