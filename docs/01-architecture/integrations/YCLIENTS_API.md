# YCLIENTS REST API

Это официальный документ, описывающий взаимодействие с сервисом онлайн-бронирования YCLIENTS.

При проектировании методов, мы старались придерживаться архитектуры [REST](https://ru.wikipedia.org/wiki/REST)

Все обращения к протоколу осуществляются с использованием SSL-шифрования.

**Лимиты**
200 запросов в минуту, или 5 запросов в секунду на один IP-адрес.

**URL API:** [https://api.yclients.com](https://api.yclients.com/)

_Вопросы, пожелания, сообщения об ошибках можно направлять по адресу [support@yclients.com](mailto:support@yclients.com)_

API позволяет сторонним разработчикам выполнять
большинство операций с платформой YCLIENTS.

**Внимание! Большинство обращений в техническую поддержку связаны**
**с тем, что разработчики не читают документацию.**
**Обязательно прочтите раздел INTRODUCTION полностью и внимательно ознакомьтесь с информацией**
**на других ресурсах, на которые мы ссылаемся. Для тестирования запросов мы рекомендуем использовать сервис [Postman](https://www.getpostman.com/),**
**при обращении в службу поддержки используйте скриншоты из Postman.**

## [section/SDK](https://developers.yclients.com/ru/\#section/SDK) SDK

Ниже приведены ссылки на SDK сторонних разработчиков. В ближайшее время мы планируем подключиться к их улучшению и развитию. И всегда привествуем Opensource инициативы, если у вас есть возможности и желание развивать одну из предложенных библиотек это принесет общую пользу. Если решите создать свою - сообщите нам о ней, мы примем участие в развитии и разместим ссылку на нее здесь.

**PHP:** [https://github.com/SlowProg/yclients-api](https://github.com/SlowProg/yclients-api)

## [section/Kejsy-integracii-s-YCLIENTS](https://developers.yclients.com/ru/\#section/Kejsy-integracii-s-YCLIENTS) Кейсы интеграции с YCLIENTS

1. Обмен данными с программой для автоматизации и учета.

2. Интеграция онлайн-записи со стронними сайтами и мобильными приложениями (каталоги компаний, приложения компаний и т.п.)


## [section/Obshee-opisanie-obmena-dannymi-s-YCLIENTS](https://developers.yclients.com/ru/\#section/Obshee-opisanie-obmena-dannymi-s-YCLIENTS) Общее описание обмена данными с YCLIENTS

API для интеграции с YCLEINTS содержит две группы методов:

1. _Методы требующие авторизацию пользователя и авторизацию партнера_
2. _Методы не требующие авторизации пользователя, но требующие авторизацию партнера_

### Авторизация запросов API

Для обращений и к первой и ко второй группе методов
требуется _авторизация партнера_. Т.е. передача
уникального hash-ключа партнера.

Авторизация запросов к API производится в соответствии с [RFC 6749 "Resource Owner Password Credentials Grant"](https://tools.ietf.org/html/rfc6749#section-4.3).
При запросах к API в HTTP заголовок Authorization должен быть включен ключ доступа в следущем формате:

```
Authorization: Bearer <partner token>

```

Для того, чтобы получить этот ключ нужно [зарегистрироваться в маркетплейсе интеграций](https://yclients.com/appstore/developers), а потом скопировать API-ключ в разделе «Настройки аккаунта».

Для получения API-ключа пользователя используйте метод **auth**. Передавать сам ключ нужно также в заголовке запроса (после ключа партнера через запятую):

```
Authorization: Bearer <partner token>, User <user token>

```

Нужна ли авторизация пользователя для работы с теми или иными сущностями нужно смотреть в описаниях формата данных и примерах запросов.

### Версионирование API

Текущая версия формата ответа 2.0, в нем всегда присутствуют секции "success", "data", "meta".

Указать версию необходимо с помощью заголовка

```
Accept: application/vnd.yclients.v2+json

```

### Дата и время

Все даты в API представлены в виде строк в формате ISO 8601:

```
"2014-09-21T23:00:00.000+03:00"

```

Длительности услуг и других сущностей передаются в **секундах**. Например, если услуга длиться 15 минут, то формат данных следующий:

```
{ "length": 900 }

```

## [section/Koncepty-YCLIENTS-API](https://developers.yclients.com/ru/\#section/Koncepty-YCLIENTS-API) Концепты YCLIENTS API

API позволяет работать с основными сущностями платформы:

- **Компания**

- **Пользователь**
Пользователи могут управлять компаниями,
они имеют права доступа к определенным настройкам компании.
Не все пользователи имеют доступ ко всем настройкам.
Для того, чтобы изменять те или иные настройки нужно сначала
получить API-ключ пользователя с соответсвующими правами.

- **Категория услуг**
Все услуги компании группируются в рамках категории услуг .

- **Услуга**
Как правило, запись производится на определенную услугу,
которую оказывает определенный сотрудник в определенной компании.
Услуга имеет диапазон стоимости и некоторые другие параметры.

- **Сотрудник**
Как правило, запись производится, к определенному сотруднику
или _ресурсу_ (например, подъемник или квест-комната).

- **Расписание сотрудника**
У каждого сотрудника есть график работы \- итервалы времени, в которое
сотрудник работает с клиентами.

- **Свободное время сотрудника**
Время на которое можно записаться
к сотруднику, т.е. интервалы времени, в которые он свободен.

- **Запись**
Интервал времени, в которое конкретный сотрудник оказывает
конкретному клиенту услуги. Во время записи сотрудник занят.

- **Клиент**
Человек, который записывался на услугу в компанию.


### Модель данных YCLIENTS API

Для работы с данными используется четыре основных структуры:

1. **Сущность**
    Одна из перечисленных выше сущностей,
    обладающая своими уникальными свойствами и параметрами.
    Сущности можно получать, изменять и удалять

2. **Коллекция сущностей**
    Набор сущностей. Например, список компаний
    или список услуг, оказываемых компаний.
    В коллекции сущностей можно _добавлять_
    сущности.

3. **Связь сущностей**
    Например, связь сотрудника и услуги
    определяет, что конкретный сотрудник
    оказывает конкретную услугу.
    У связи могут быть свои свойства,
    например, индивидуальная цена услуги
    для конкретного сотрудника

4. **Коллекция связей сущностей**
    Например, список услуг, оказываемых
    сотрудником и их свойсва. В коллекции
    можно _добавлять связи_


# [tag/Avtorizaciya](https://developers.yclients.com/ru/\#tag/Avtorizaciya) Авторизация

Для вызова многих методов требуется получить API-ключ пользователя, который будет использоваться для доступа к закрытым данным.

## [tag/Avtorizaciya/operation/Авторизовать пользователя](https://developers.yclients.com/ru/\#tag/Avtorizaciya/operation/%D0%90%D0%B2%D1%82%D0%BE%D1%80%D0%B8%D0%B7%D0%BE%D0%B2%D0%B0%D1%82%D1%8C%20%D0%BF%D0%BE%D0%BB%D1%8C%D0%B7%D0%BE%D0%B2%D0%B0%D1%82%D0%B5%D0%BB%D1%8F) Авторизовать пользователя

post/auth

https://api.yclients.com/api/v1/auth

При смене пароля пользователем его API-ключ изменится и потребуется новая авторизация

| Атрибут | Тип | Описание |
| --- | --- | --- |
| login | string | В качестве логина может быть использован номер телефона пользователя в формате 79161234567 или его Email |
| password | string | Пароль пользователя |

##### Authorizations:

_bearer_

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| login<br>required | string<br>Номер телефона или Email |
| password<br>required | string<br>Пароль |

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| id | integer<int32><br>Идентификатор пользователя |
| user\_token | string<br>User\_token пользователя |
| name | string<br>Имя пользователя |
| phone | string<br>Телефон пользователя |
| login | string<br>Логин пользователя |
| email | string<br>Почтовый адрес пользователя |
| avatar | string<br>Путь к файлу аватарки пользователя |
| is\_approved | boolean<br>Подтвержден ли пользователь в системе |

### Request samples

- Payload

Content type

application/json

Copy

`{
"login": "testuser@yclients.com",
"password": "testpass"}`

### Response samples

- 201

Content type

application/json

Copy

`{
"id": 123456,
"user_token": "wec23fh8cDfFV4432fc352456",
"name": "Иван Попов",
"phone": "79161001010",
"login": "79161001010",
"email": "test@test.com",
"avatar": "https://assets.yclients.com/general/0/01/123456789098765_12345678909876.png",
"is_approved": true}`

## [tag/Avtorizaciya/operation/Авторизовать пользователя онлайн-записи](https://developers.yclients.com/ru/\#tag/Avtorizaciya/operation/%D0%90%D0%B2%D1%82%D0%BE%D1%80%D0%B8%D0%B7%D0%BE%D0%B2%D0%B0%D1%82%D1%8C%20%D0%BF%D0%BE%D0%BB%D1%8C%D0%B7%D0%BE%D0%B2%D0%B0%D1%82%D0%B5%D0%BB%D1%8F%20%D0%BE%D0%BD%D0%BB%D0%B0%D0%B9%D0%BD-%D0%B7%D0%B0%D0%BF%D0%B8%D1%81%D0%B8) Авторизовать пользователя онлайн-записи

post/booking/auth

https://api.yclients.com/api/v1/booking/auth

При смене пароля пользователем онлайн-записи его API-ключ изменится и потребуется новая авторизация

| Атрибут | Тип | Описание |
| --- | --- | --- |
| login | string | В качестве логина может быть использован номер телефона посетителя в формате 79161234567 или его Email |
| password | string | Пароль посетителя |

##### Authorizations:

_bearer_

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| login<br>required | string<br>Номер телефона или Email |
| password<br>required | string<br>Пароль |

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| id | integer<int32><br>Идентификатор пользователя |
| user\_token | string<br>User\_token пользователя |
| name | string<br>Имя пользователя |
| phone | string<br>Телефон пользователя |
| login | string<br>Логин пользователя |
| email | string<br>Почтовый адрес пользователя |
| avatar | string<br>Путь к файлу аватарки пользователя |

### Request samples

- Payload

Content type

application/json

Copy

`{
"login": "testuser@yclients.com",
"password": "testpass"}`

### Response samples

- 201

Content type

application/json

Copy

`{
"id": 123456,
"user_token": "wec23fh8cDfFV4432fc352456",
"name": "Иван Попов",
"phone": "79161001010",
"login": "79161001010",
"email": "test@test.com",
"avatar": "https://assets.yclients.com/general/0/01/123456789098765_12345678909876.png"}`

# [tag/Onlajn-zapis](https://developers.yclients.com/ru/\#tag/Onlajn-zapis) Онлайн-запись

Для реализации клиентской части онлайн-записи используется следующий набор методов. Они адаптированы для пользовательских сценариев онлайн-записи, в отличии от других REST-методов, которые лучше использовать для интеграциионных целей.

## [tag/Onlajn-zapis/operation/Получить настройки формы бронирования](https://developers.yclients.com/ru/\#tag/Onlajn-zapis/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D0%BD%D0%B0%D1%81%D1%82%D1%80%D0%BE%D0%B9%D0%BA%D0%B8%20%D1%84%D0%BE%D1%80%D0%BC%D1%8B%20%D0%B1%D1%80%D0%BE%D0%BD%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D1%8F) Получить настройки формы бронирования

get/bookform/{id}

https://api.yclients.com/api/v1/bookform/{id}

Каждый клиент сервиса YCLIENTS, может создать неограниченное количество форм онлайн-записи с разным дизайном и для разных сценариев записи.

Обычно, id формы бронирования хранится в поддомене, например: [https://w123.yclients.com](https://w123.yclients.com/), где 123 - id формы записи. С помощью этого параметра можно получить все остальные необходимые для реализации онлайн-записи параметры, понять, будет происходить запись в конкретную компанию или в сеть компаний.

Для сетевого виджета необходимо будет дополнительно обратится к методу \[GET\] /companies с фильтром company\_id и получить список копаний, в которые будет производиться запись.

Объект содержащий настройки формы бронирование имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| steps | Массив объектов | Шаги формы бронирования со своими настройками |
| style | Object | Настройки дизайна формы бронирования |
| group\_id | number | Идентификатор сети компаний (0 - если форма записи для несетевой компании) |
| company\_id | number | Идентификатор компании (возвращается всегда, используется для получения дополнительных настроек) |
| phone\_confirmation | boolean | Нужно ли подтверждать телефон по смс (если groupid = 0 (не групповая форма), иначе смотреть в настройки каждой компании отдельно) |
| lang | string | Язык формы бронирования (код из массива langs) |
| langs | array of object | Список языков виджета |
| comment\_required | boolean | Является ли поле с комментарием к записи обязательным для заполнения |
| metrika\_counter\_id | string | Идентификатор Яндекс.Метрики |
| google\_analytics\_id | string | Идентификатор Google Analytics |
| facebook\_pixel\_id | string | Идентификатор Facebook Pixel |
| vkontakte\_pixel\_id | string | Идентификатор Вконтакте пиксель |
| app\_metrika\_id | string | Идентификатор Yandex AppMetrika |
| sms\_enabled | boolean | Доступна ли отправка смс |
| comment\_input\_name | string (optional) | Заголовок для поля с вводом комментария к записи (если не задано, то используется значение по умолчанию) |
| booking\_notify\_text | string (optional) | Текст уведомления, которое выводится (если задано) на шаге ввода контактных данных |
| is\_show\_privacy\_policy | boolean | Нужно ли отображать пользователю текст соглашения о политике обработки персональных данных |
| specialization\_display\_mode | number | Выводить специализацию или должность сотрудника. 0 - Специализация, 1 - Должность |

Массив steps состоит из объектов которые имеют следующие поля:

| Поле | Тип | Описание | Для каких шагов указан |
| --- | --- | --- | --- |
| step | string | Шаг city/company/service/master/datetime/contact/confirm | Для всех |
| title | string | Название шага для вывода в интерфейсе | Для всех |
| num | number | Каким по счету должен выводиться данный шаг (начиная с 1) | Для всех |
| default | string или number | Значение по умолчанию для данного шага, если задано | Для всех, кроме datetime |
| hidden | boolean | Скрыть данный шаг при бронировании или нет | Для всех |
| date\_hidden | boolean | Скрыть данный шаг при бронировании или нет | Для datetime |
| time\_hidden | boolean | Скрыть данный шаг при бронировании или нет | Для datetime |
| date\_default | string | Значение по умолчанию для данного шага, если задано | Для datetime |
| time\_default | number | Значение по умолчанию для данного шага, если задано | Для datetime |

Объект style имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| show\_header | boolean | Выводить шапку и меню или нет |
| logo | string | Путь до картинки логотипа |
| header\_background | string | Путь до картинки фона подзаголовка |
| menu\_background | string | Путь до картинки фона меню |
| primaryPalette | string | Главный цвет формы (все цвета из списка: red, pink, purple, deep-purple, indigo, blue, light-blue, cyan, teal, green, light-green, lime, yellow, amber, orange, deep-orange, brown, grey, blue-grey, white, black) |
| accentPalette | string | Второстепенный цвет формы (полупрозрачный cover подзаголовка) |
| warnPalette | string | Цвет кнопок формы записи |
| backgroundPalette | string | Цвет фона формы записи |

##### Authorizations:

_bearer_

##### path Parameters

|     |     |
| --- | --- |
| id<br>required | number<br>Example:1<br>id формы бронирования |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"steps": [\
{\
"step": "master",\
"title": "Выберите спеца",\
"num": 2,\
"hidden": "0",\
"default": -1},\
{\
"step": "service",\
"title": "Выберите услугу",\
"num": 1,\
"hidden": "1",\
"default": "196"},\
{\
"step": "datetime",\
"title": "Выберите дату и время сеанса",\
"num": 3,\
"hidden": false,\
"date_hidden": "0",\
"time_hidden": "0",\
"date_default": 1437609600,\
"time_default": "27900"},\
{\
"step": "contact",\
"title": "",\
"num": 3,\
"hidden": false,\
"default": 0},\
{\
"step": "comfirm",\
"title": "",\
"num": 4,\
"hidden": false,\
"default": 0}],
"style": {
"show_header": true,
"logo": "https://yclients.com/uploads/logo.png",
"header_background": "https://yclients.com/uploads/header.png",
"menu_background": "https://yclients.com/uploads/menu.png",
"main_color": "666",
"secondary_color": "999",
"buttons_color": "FFF"},
"group_id": 1,
"company_id": 1,
"phone_confirmation": false,
"lang": "ru-RU",
"langs": [\
{\
"id": 1,\
"code": "ru-RU",\
"title": "Русский"},\
{\
"id": 2,\
"code": "en-US",\
"title": "English"},\
{\
"id": 4,\
"code": "lv-LV",\
"title": "Latviešu valoda"},\
{\
"id": 5,\
"code": "et-EE",\
"title": "Eesti keel"},\
{\
"id": 6,\
"code": "lt-LT",\
"title": "Летува́"},\
{\
"id": 7,\
"code": "uk-UK",\
"title": "Українська"},\
{\
"id": 8,\
"code": "fr-FR",\
"title": "Français"},\
{\
"id": 9,\
"code": "it-IT",\
"title": "Italiano"},\
{\
"id": 10,\
"code": "es-ES",\
"title": "Español"},\
{\
"id": 13,\
"code": "ka-KA",\
"title": "ქართული"},\
{\
"id": 14,\
"code": "hy-AM",\
"title": "Հայերեն"},\
{\
"id": 15,\
"code": "kk-KK",\
"title": "қазақ тілі"},\
{\
"id": 16,\
"code": "hr-HR",\
"title": "Hrvatski jezik"},\
{\
"id": 17,\
"code": "cs-CS",\
"title": "český jazyk"},\
{\
"id": 18,\
"code": "ro-RO",\
"title": "Limba Română"},\
{\
"id": 19,\
"code": "cn-CN",\
"title": "中文"},\
{\
"id": 20,\
"code": "ar-AR",\
"title": "العَرَبِيَّة"},\
{\
"id": 21,\
"code": "bg-BG",\
"title": "Български"},\
{\
"id": 22,\
"code": "he-IL",\
"title": "עברית"},\
{\
"id": 23,\
"code": "hu-HU",\
"title": "Magyar nyelv"},\
{\
"id": 24,\
"code": "Lt-sr-SP",\
"title": "Srpski jezik"},\
{\
"id": 25,\
"code": "sk-SK",\
"title": "Slovenský jazyk"},\
{\
"id": 26,\
"code": "mn-MN",\
"title": "Монгол хэл"},\
{\
"id": 27,\
"code": "az-AZ",\
"title": "Azərbaycan dili"},\
{\
"id": 28,\
"code": "pl-PL",\
"title": "Polszczyzna"},\
{\
"id": 30,\
"code": "sl-SL",\
"title": "Slòvēnskī"}],
"comment_required": false,
"metrika_counter_id": "50217133",
"google_analytics_id": "UA-125358345-1",
"facebook_pixel_id": "2218788388343154",
"vkontakte_pixel_id": "VK-RTRG-96471-KZ24cpR",
"app_metrika_id": "46ab3b93-1bc6-457d-82f0-c1b51f39b01e",
"sms_enabled": true},
"meta": [ ]}`

## [tag/Onlajn-zapis/operation/Получить параметры интернационализации](https://developers.yclients.com/ru/\#tag/Onlajn-zapis/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D0%BF%D0%B0%D1%80%D0%B0%D0%BC%D0%B5%D1%82%D1%80%D1%8B%20%D0%B8%D0%BD%D1%82%D0%B5%D1%80%D0%BD%D0%B0%D1%86%D0%B8%D0%BE%D0%BD%D0%B0%D0%BB%D0%B8%D0%B7%D0%B0%D1%86%D0%B8%D0%B8) Получить параметры интернационализации

get/i18n/{langCode}

https://api.yclients.com/api/v1/i18n/{langCode}

Перевод доступен на один из языков:

- Русский \- 'ru-RU'
- Латвийский \- 'lv-LV'
- Английский \- 'en-US'
- Эстонский \- 'ee-EE'
- Литовский \- 'lt-LT'
- Немецкий \- 'de-DE'
- Украинский \- 'uk-UK'

##### Authorizations:

_bearer_

##### path Parameters

|     |     |
| --- | --- |
| langCode<br>required | string<br>Example:ru-RU<br>Код языка. Один из набора 'ru-RU', 'lv-LV', 'en-US', 'ee-EE', 'lt-LT', 'de-DE', 'uk-UK' |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| 404 | object |
| action | object |
| tips | object |
| payment-status | object |
| user-data-form | object |
| and | string |
| terms-of-agreement | string |
| data-processing | string |
| license-agreement | string |
| personal-data | string |
| buy-for | string |
| group\_booking | object |
| geo | object |
| tooltips | object |
| prepaid | object |
| back | string |
| backCity | string |
| backFilials | string |
| backRecordType | string |
| filials | string |
| my\_profile | string |
| about\_us | string |
| record | object |
| at | string |
| on | string |
| h | string |
| m | string |
| from | string |
| dist\_m | string |
| dist\_km | string |
| yesterday | string |
| today | string |
| tomorrow | string |
| Close | string |
| Yes | string |
| No | string |
| refresh | string |
| online\_record\_disabled | string |
| online\_record\_disabled\_long\_text | string |
| address | object |
| common | object |
| notification | object |
| header | object |
| loyalty | object |
| save | string |
| proceed | string |
| profile | object |
| registration | object |
| menu | object |
| footer | object |
| city | object |
| company | object |
| steps | object |
| master | object |
| cart | object |
| reviews | object |
| date | object |
| time | object |
| service | object |
| confirm | object |
| login | object |
| Jan | string |
| Feb | string |
| March | string |
| Mar | string |
| Apr | string |
| May | string |
| Jun | string |
| Jul | string |
| Aug | string |
| Sep | string |
| Oct | string |
| Nov | string |
| Dec | string |
| activity | object |
| button | object |
| landscape | string |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"404": {
"not-found": "Кажется, такой страницы не существует",
"not-found-record": "Такая запись не существует.",
"go-home": "На главную"},
"action": {
"send": "Отправить"},
"tips": {
"terms": {
"prefix": "Нажимая «Отправить», вы принимаете",
"of-use": "Условия использования",
"personal-policy": "Политику конфиденциальности"},
"review-sent": "Отзыв отправлен",
"your-mark": "Ваша оценка",
"leave-a-review": "Оставьте отзыв",
"leave-a-tip-to-a-specialist": "Оставить чаевые специалисту",
"credited": "Чаевые зачислены",
"visit-amount": "Сумма визита",
"will-be-written-off": "Будет списано",
"at-time": "в",
"rate-specialist-to-sent-feedback": "Поставьте оценку специалисту, чтобы отправить отзыв",
"title": "Чаевые",
"tips-required": "Пожалуйста, выберите сумму чаевых",
"review-or-tips-required": "Кажется, пока нечего отправить специалисту",
"enter-sum": "Введите сумму",
"custom-sum": "Своя сумма",
"cancel-tips": "Отменить чаевые",
"bad-sum": "Чаевые должны быть указаны суммой"},
"payment-status": {
"payment-error": "Ошибка оплаты. Повторите попытку",
"payment-redirect": "Вас должно направить на платежную систему.",
"payment-config-error": "Ошибка в настройке платежной системы",
"contact-us-for-questions": "Свяжитесь с нами если у вас остались вопросы.",
"contacts": "Контакты",
"order-registered": "Заявка оформлена",
"order-paid": "Заказ оплачен",
"retry": "Повторить",
"order-created-successfully": "Заказ успешно создан. С вами свяжется наш представитель для уточнения деталей.",
"order-is-being-processed": "Операция обрабатывается",
"get-payment-data": "Получение данных о платеже",
"transaction-number": "Номер транзакции",
"payment-transaction-info-1": "Если Вам пришел чек, то покупка успешно завершена. Проверьте указанную при покупке почту.",
"payment-transaction-info-2": "    Если чек не пришел, попробуйте снова или обратитесь к нам по контактам ниже.",
"order-number-info": "Сообщите этот номер при посещении, чтобы воспользоваться сертификатом или абонементом."},
"user-data-form": {
"loyalty-phone-tip": "Сообщите этот номер при посещении, чтобы воспользоваться сертификатом или абонементом.",
"name-required": "Необходимо указать имя",
"email-required": "Необходимо указать email",
"loyalty-email": "E-mail для получения чека и покупки",
"agreement-link": "с условиями соглашения",
"data-processing-link": "обработкой данных",
"terms-prefix": "Нажимая на кнопку вы соглашаетесь",
"proceed": "Оформить",
"pay": "Оплатить",
"phone-code": "Код",
"phone": "Телефон",
"invalid-phone": "Некорректный номер"},
"and": "и",
"terms-of-agreement": "Условия соглашения",
"data-processing": "Обработка данных",
"license-agreement": "Лицензионное соглашение",
"personal-data": "Ваши данные",
"buy-for": "Купить за",
"group_booking": {
"personal_booking": "Индивидуальные услуги",
"group_booking": "Групповые события",
"choose_group_event": "Выберите событие",
"group_events_available": "Доступна запись на групповые события",
"places": "Мест",
"group_events_is_not_available": "На выбранный день нет групповых событий",
"group_events_is_not_available_filial": "В этом филиале пока не настроены групповые события",
"repeat": "Записаться снова",
"duration": "Длительность",
"no_space": "Нет мест",
"not_found": "Нет событий по выбранным фильтрам. Попробуйте изменить параметры фильтрации"},
"geo": {
"geo_timeout_error": "Не удается определить ваше местоположение. Возможно Вы находитесь вне зоны работы GPS",
"geo_timeout_error_android": "Не удается определить ваше местоположение. Возможно Вы находитесь вне зоны работы GPS. Если у Вас отключена геолокация, ее нужно включить и перезапустить приложение.",
"geo_access_error": "Нет доступа к определению вашего местоположения. Приложение не может показать ближайшие к Вам филиалы. Если у Вас отключена геолокация, ее нужно включить и перезапустить приложение."},
"tooltips": {
"change_filial": "Теперь Вы будете начинать запись всегда с этого филиала. Изменить филиал можно через пункт меню",
"change_filial_back_button": "Также можно использовать кнопку «Назад» для смены филиала"},
"prepaid": {
"required": "предоплата обязательна",
"allowed": "предоплата опциональна",
"prepaid_sum": "К оплате онлайн:",
"postpaid_sum": "Оплата на месте:"},
"back": "Назад",
"backCity": "Города",
"backFilials": "Филиалы",
"backRecordType": "Тип записи",
"filials": "Филиалы",
"my_profile": "Кабинет",
"about_us": "О нас",
"record": {
"show_details": "Смотреть детали",
"is_canceled": "Запись отменена",
"is_canceled_success": "Запись успешно отменена",
"record": "Запись",
"place": "Место",
"master": "Сотрудник",
"service": "Услуга",
"services": "Услуги",
"date": "Дата",
"past": "Прошла",
"through": "Через",
"time": "Время",
"clients_count": "Количество мест:",
"book_visit": "Оформить визит",
"add_service": "+ Добавить услугу",
"add_master": "+ Добавить мастера",
"add_datetime": "+ Добавить дату и время",
"cancel_record": "Отменить запись",
"cancel_record_warning": "После отмены запись будет невозможно восстановить",
"confirm_cancel_record": "Вы уверены, что хотите отменить запись?",
"error_cancel_record": "Вы не можете отменить запись",
"error_cancel_record_new1": "Невозможно отменить запись онлайн. Пожалуйста, свяжитесь с администратором.",
"error_cancel_record_new2_1": "Невозможно отменить запись онлайн за ",
"error_cancel_record_new2_2": "до посещения. Пожалуйста, свяжитесь с администратором.",
"add_to_google_calendar": "Добавить в google-календарь",
"booking_success": "Вы успешно записались!",
"create_new_record": "Записаться еще",
"future_records": "Предстоящие сеансы",
"past_records": "Прошедшие",
"change_record_time": "Перенести запись",
"error_change_record_time": "Невозможно перенести запись онлайн. Пожалуйста, свяжитесь с администратором.",
"error_change_record_time2_1": "Невозможно перенести запись онлайн за ",
"error_change_record_time2_2": "до посещения. Пожалуйста, свяжитесь с администратором.",
"selected_services": "Выбранные услуги",
"calculate_services": "Определяются доступные услуги...",
"change_record_fail": "Ошибка при переносе записи, попробуйте выбрать другое время",
"continue_booking": "Продолжить запись",
"go_to_registration": "Перейти на сайт YCLIENTS",
"repeat": "Повторить запись",
"is_deleted": "Ваша запись удалена."},
"at": "в",
"on": "на",
"h": "ч.",
"m": "мин.",
"from": "из",
"dist_m": "м",
"dist_km": "км",
"yesterday": "вчера",
"today": "сегодня",
"tomorrow": "завтра",
"Close": "Закрыть",
"Yes": "Да",
"No": "Нет",
"refresh": "Обновить",
"online_record_disabled": "Онлайн запись отключена. <br> Приносим извинения за доставленные неудобства.",
"online_record_disabled_long_text": "Онлайн-запись временно недоступна. Вы по-прежнему можете управлять своими онлайн-записями в личном кабинете, переносить их и удалять.",
"address": {
"about": "О компании",
"address": "Адрес",
"phone": "Телефон",
"phones": "Телефоны",
"schedule": "Время работы",
"site": "Сайт",
"date_and_time": "Дата и время",
"photos": "Фотографии",
"details": "Подробнее о салоне"},
"common": {
"information": "информация",
"reviews": "отзывы",
"contacts": "контакты"},
"notification": {
"your_city": "Ваш город <%- city_name %>?",
"yes_my_city": "Да, это мой город",
"no_my_city": "Нет, выбрать город",
"read_all": "Прочитать",
"delete_all": "Удалить",
"deleted_record": "Удаление записи",
"record": "Запись",
"news": "Новости",
"review": "Отзыв о мастере",
"notify": "Уведомление",
"sent": "Отправлено"},
"header": {
"loyalty_cards": "Карты лояльности",
"widget_settings": "Настройки виджета",
"settings": "Настройки",
"select_town": "Выберите город",
"select_company": "Выберите филиал",
"select_date": "Выбор даты",
"select_master": "Выбор сотрудника",
"select_time": "Выбор времени",
"select_service": "Выбор услуги",
"input_personal": "Ввод контактных данных",
"online_record": "Онлайн-запись",
"selection_of": "Выбор",
"contacts_form": "Оформление",
"record_created": "Запись создана!",
"login": "Вход",
"profile": "Личный кабинет",
"my_records": "Мои записи",
"record_create_disabled": "Онлайн-запись временно недоступна.",
"master-info": "О сотруднике",
"notification": "Уведомления",
"my_notifications": "Мои уведомления",
"none_notifications": "Нет уведомлений",
"cart": "Подтверждение оплаты",
"change_record": "Перенос записи",
"you_booking": "Ваш заказ",
"you_data": "Ваши данные",
"record": "Запись",
"actions": "Действия",
"cancel-record": "Отмена записи",
"booking_again": "Записаться снова",
"choose_time": "Выберите время",
"choose_staff": "Выберите специалиста",
"about_service": "Об услуге",
"records": "Записи",
"confirmation": "Подтверждение"},
"loyalty": {
"empty-list": "Здесь пока ничего нет",
"points": {
"nominative": "балл",
"genitive": "балла",
"plural-genitive": "баллов"},
"no_cards": "У Вас нет ни одной карты.",
"no_certificate": "У Вас нет ни одного сертификата.",
"no_subscription": "У Вас нет ни одного абонемента.",
"discount": "скидка",
"cashback": "cashback",
"paid_amount": "Оплачено",
"sold_amount": "Продано",
"visit_count": "Визиты",
"balance": "Накоплено (cashback)",
"certificate": {
"services-includes": "Что включено",
"no-restrictions": "Без ограничений",
"restrictions-only-services": "Все услуги, кроме товаров",
"any-goods": "Любые товары",
"without-goods": "Товары не включены",
"without-services": "Услуги не включены",
"validity": "Срок действия",
"validity-without-restrictions": "Без ограничения срока действия",
"validity-till": "До",
"validity-after-purchase": "с момента покупки",
"use-type": "Использование",
"use-type-multiple": "Многократно",
"use-type-single": "Однократно",
"where-to-use": "Где использовать?",
"where-to-use-show-more": "Показать больше",
"where-to-use-all-group": "Во всей сети",
"allow-to-freeze": "Возможность заморозки",
"title": "Сертификат",
"one-off-use": "Одноразовый",
"multi-use": "Многоразовый",
"denomination": "Номинал",
"balance": "Остаток"},
"subscription": {
"validity-without-restrictions": "без ограничений по количеству дней",
"title": "Абонемент"},
"subscriptions": {
"all-services": "(все услуги)",
"from": "из",
"valid_until": "Действителен до",
"valid_unlimited": "Срок действия не ограничен",
"unused": "Абонемент еще не использовался",
"online_sale_button_text": "Купить сертификат или абонемент"},
"programs": {
"item_type_id": {
"any_services_any_goods": "Ко всем услугам и товарам",
"any_service_no_goods": "К любым услугам",
"no_services_any_goods": "К любым товарам",
"custom_services_no_goods": "К некоторым услугам",
"custom_services_any_goods": "К некоторым услугам и любым товарам",
"no_services_custom_goods": "К некоторым товарам",
"any_services_custom_goods": "К любым услугам и некоторым товарам",
"custom_services_custom_goods": "К некоторым услугам и товарам",
"no_services_no_goods": "Не для услуг; не для товаров"},
"determined_action_settings": "Определяется настройками акции"}},
"save": "Сохранить",
"proceed": "Продолжить",
"profile": {
"name": {
"saved": "Имя пользователя изменено на ",
"not_known": "Имя неизвестно"},
"noFutureRecords": "У вас нет предстоящих сеансов",
"noPastRecords": "У вас нет прошедших сеансов",
"phone": {
"confirm": "Подтвердить телефон"},
"email": {
"info": "Вам отправлено письмо для подтверждения email на "},
"password": {
"info": "Пароль должен содержать не менее восьми символов",
"badPassword": "Указан неверный пароль",
"current": "Текущий пароль",
"new": "Новый пароль",
"invalidTooShort": "",
"invalidNoDigit": "",
"invalidNoCapital": "",
"invalidNoSymbol": ""},
"error": "При сохранении данных произошла ошибка",
"saved": "Изменения ваших персональных данных сохранены",
"contactsDetails": "Контактные данные",
"your_records": "Ваши записи в салон."},
"registration": {
"registration": "Регистрация",
"form": {
"name": "Ваше имя",
"company_title": "Название компании",
"i_know_promo": "Я знаю промокод",
"confirm_oferta_1": "Я принимаю условия",
"confirm_oferta_2": "договора-оферты",
"submit": "Зарегистрироваться",
"promo": "промо-код",
"unknownError": "Произошла системная ошибка, попробуйте зарегистрироваться позже"}},
"menu": {
"account": "Личные данные",
"change_filial": "Изменить филиал",
"change_city": "Изменить город",
"online_record": "Онлайн запись",
"about": "О компании",
"change_lang": "Изменить язык",
"hide_menu": "Скрыть меню",
"login": "Войти",
"myRecords": "Мои записи",
"on-line": "Онлайн-запись",
"logout": "Выйти",
"my": "Личный кабинет",
"favorite": "Избранное",
"change_password": "Смена пароля",
"header": "Меню",
"profile": "Профиль",
"loyalty": "Мои карты",
"loyalty_subscriptions": "Абонементы",
"loyalty_certificates": "Сертификаты"},
"footer": {
"worked_on": "Работает на",
"worked_on_company_name": "YCLIENTS"},
"city": {
"town_abbreviation": "г. ",
"service_count": "Количество филиалов:",
"select_filial": "Выбор филиала",
"not_found_cities": "По вашему запросу города не найдены",
"search_cities": "Найти города",
"affiliate": {
"1": "филиал",
"2": "филиала",
"3": "филиалов"}},
"company": {
"list": "Список",
"on_map": "На карте",
"no_companies_text_1": "У Вас нет ни одной активной компании. Для настройки компаний перейдите в",
"lk": "Личный кабинет YCLIENTS",
"no_companies_text_2": "После настройки нажмите кнопку",
"no_companies": "Нет компаний",
"near_session": "Ближайший доступный сеанс для записи:",
"active_master": "Активных специалистов:",
"at_o_clock": "в",
"find_companies": "Найти филиалы",
"not_found_companies": "По вашему запросу филиалы не найдены",
"look_at_the_map": "Посмотреть на карте"},
"steps": {
"date_and_time": "Дата и время",
"staff": {
"nominative": "Сотрудник",
"genitive": "сотрудника"},
"service": "Услуга",
"time": "Время"},
"master": {
"master": "Специалист",
"skip_select_master": "Пропустить выбор сотрудника",
"skip_select": "Пропустить выбор",
"near_session": "Ближайшие сеансы",
"nearest_time": "Ближайшее время для записи",
"no_record": "На выбранный день нет свободных сеансов",
"no_record_new": "На эту дату нет свободного времени для записи. Выберите другую дату или другого специалиста",
"no_master": "Сотрудник уволен или больше не работает в этом филиалае",
"any_master": "Не имеет значения",
"record_is_available": "Можно записаться",
"reviews": {
"nominative": "отзыв",
"genitive": "отзыва",
"plural-genitive": "отзывов"},
"prepaid": {
"forbidden": "Предоплата не требуется",
"allowed": "Возможна предоплата",
"required": "Предоплата обязательна"}},
"cart": {
"title": "Выбранные для оплаты услуги",
"confirm": "Подтвердить запись",
"go-to-pay": "Перейти к оплате",
"confirmed": "Запись оплачена",
"pay-success": "Оплата прошла успешно!"},
"reviews": {
"cancelAddReview": "Отмена",
"later": "Оценить позже",
"addReview": "Оставить отзыв",
"yourReviewMark": "Ваша оценка",
"reviewFieldLabelText": "Ваш отзыв",
"reviewTitle": "Пожалуйста, оцените качество работы приложения",
"reviewMessage": "Напишите предложения по доработкам",
"reviewRequestStoreTitle": "Хотите оставить оценку в магазине?",
"reviewButton": "Оценить",
"thanksForReview": "Спасибо за отзыв"},
"date": {
"day_of": "Выходной",
"no_record": "Рабочий, записи нет",
"have_record": "Рабочий, запись есть",
"by_month_num": {
"1": "Январь",
"2": "Февраль",
"3": "Март",
"4": "Апрель",
"5": "Май",
"6": "Июнь",
"7": "Июль",
"10": "Октябрь",
"11": "Ноябрь",
"12": "Декабрь",
"08": "Август",
"09": "Сентябрь"},
"by_month_short": {
"Jan": "Января",
"Feb": "Февраля",
"March": "Марта",
"Mar": "Марта",
"Apr": "Апреля",
"May": "Мая",
"Jun": "Июня",
"Jul": "Июля",
"Aug": "Августа",
"Sep": "Сентября",
"Oct": "Октября",
"Nov": "Ноября",
"Dec": "Декабря"}},
"time": {
"hourCased": {
"nominative": "час",
"genitive": "часа",
"plural-genitive": "часов"},
"weekCased": {
"nominative": "неделя",
"genitive": "недели",
"plural-genitive": "недель"},
"monthCased": {
"nominative": "месяц",
"genitive": "месяца",
"plural-genitive": "месяцев"},
"yearCased": {
"nominative": "год",
"genitive": "года",
"plural-genitive": "лет"},
"dayCased": {
"nominative": "день",
"genitive": "дня",
"plural-genitive": "дней"},
"minuteCased": {
"nominative": "минута",
"genitive": "минуты",
"accusative": "минуту",
"plural-genitive": "минут"},
"secondCased": {
"nominative": "секунда",
"genitive": "секунды",
"accusative": "секунду",
"plural-genitive": "секунд"},
"at_o_clock": "в",
"noTimes": "На выбранный день нет свободных сеансов",
"the_part_of_day": {
"morning": "Утро",
"day": "День",
"evening": "Вечер"},
"by_week_day": {
"Mon": "Пн",
"Tue": "Вт",
"Wed": "Ср",
"Thu": "Чт",
"Fri": "Пт",
"Sat": "Сб",
"Sun": "Вс"},
"by_full_week_day": {
"Monday": "Понедельник",
"Tuesday": "Вторник",
"Wednesday": "Среда",
"Thursday": "Четверг",
"Friday": "Пятница",
"Saturday": "Суббота",
"Sunday": "Воскресенье"}},
"service": {
"selected": "Выбрано",
"selected_service_count": "Выбрано услуг:",
"noServicesAndEvents": "Не найдено ни одной акции или услуги по вашему запросу",
"noMoreServices": "Нет услуг, на которые можно записаться вместе с выбранными услугами",
"noMoreService": "Нет услуг, на которые можно записаться вместе с выбранной услугой",
"search": "Поиск...",
"sale": "Акции",
"services": "Услуги",
"add": "Добавить услугу",
"add_short": "Добавить",
"currency_short": "р.",
"services_pref": {
"1": "услугу",
"2": "услуги",
"3": "услуг"},
"order_on": "Заказ на",
"price": "цена",
"price_not_available": "Цена не указана",
"price_from": "от",
"price_to": "до",
"unavailable_service": "больше недоступна для онлайн-записи. Хотите выбрать другую?",
"unavailable_services": "больше недоступны для онлайн-записи. Хотите выбрать другие?"},
"confirm": {
"confirm": "Записаться",
"show_order_details": "Посмотреть детали заказа",
"order_details": "Детали заказа",
"smsNotify": "Напоминание",
"dontSend": "Не отправлять",
"order_on": "Заказ на услуги",
"service_sale": "Услуги по акции",
"license_text": "Duis placerat lectus et justo mollis, nec sodales orci congue. Vestibulum semper non urna ac suscipit. Vestibulum tempor, ligula id laoreet hendrerit, massa augue iaculis magna, sit amet dapibus tortor ligula non nibh.",
"accept": "Нажимая кнопку «Записаться»,  вы соглашаетесь с",
"i_accept": "Я принимаю",
"i_agree": "Я соглашаюсь с тем,",
"accept_inline": "Нажимая кнопку «Записаться»,  вы соглашаетесь",
"accept_personal_data_inline": "обработку персональных данных",
"and_accept": "и принимаете",
"terms_of_agreement": "условиями пользовательского соглашения",
"terms_of_agreement_inline": "условия пользовательского соглашения",
"how_my_personal_data_will_be_processed": "как будут обрабатываться мои персональные данные",
"first_name": "Имя",
"phone": "Телефон",
"will_be_used_to_confirm": "Будет использован для подтверждения",
"comment": "Комментарий",
"email": "Email",
"recording": "Записаться",
"code_and_phone_num": "Код и номер телефона",
"phone_confirm_short": "Подтвердите номер",
"phone_already_exists": "Заданный номер уже используется",
"phone_confirm": "Подтвердите номер телефона",
"phone_confirm_button": "Подтвердить",
"defaultError": "Системная ошибка:",
"you_want_to_book": "Вы хотите записаться",
"your_master": "Ваш мастер",
"waiting_for_you_at_the_address": "Мы ждем вас по адресу",
"untilVisit": {
"postfix": "до визита",
"prefix": "За"},
"orderErrorsActions": {
"changeService": "Выбрать другие услуги",
"changeTime": "Выбрать другое время",
"changeRecord": "Изменить запись",
"deleteRecord": "Удалить запись"},
"orderErrors": {
"unknown": "некорректные параметры записи",
"server": "что-то пошло не так, попробуйте позже",
"code_400": "некорректный email",
"code_404": "некорректные параметры записи",
"code_422": "некорректные параметры записи",
"code_437": "пересечение по времени с другим визитом",
"code_433": "невозможно записаться на выбранное время",
"code_436": "нет сотрудников доступных для записи",
"code_438": "невозможно  записаться на выбранные услуги",
"code_501": "неизвестная ошибка",
"bigLetter": {
"unknown": "Некорректные параметры записи",
"server": "Что-то пошло не так, попробуйте позже",
"code_400": "Некорректный email",
"code_404": "Некорректные параметры записи",
"code_422": "Некорректные параметры записи",
"code_437": "Пересечение по времени с другим визитом",
"code_433": "Невозможно записаться на выбранное время",
"code_436": "Нет сотрудников доступных для записи",
"code_438": "Невозможно  записаться на выбранные услуги",
"code_501": "Неизвестная ошибка"}},
"errors": {
"name": {
"required": "Введите имя"},
"company": {
"required": "Введите название компании"},
"phone": {
"required": "Введите телефон",
"incorrect": "Неверный номер"},
"email": {
"required": "Введите email",
"invalid": "Некорректный формат email"},
"agreement": {
"required": "Вы должны принять пользовательское соглашение"},
"agreement_privacy_and_terms_of_use": {
"required": "Для продолжения необходимо принять пользовательское соглашение, а также дать согласие на обработку персональных данных"},
"comment_default": {
"required": "Введите комментарий"},
"comment": {
"required": "Заполните поле"},
"code": {
"incorrect": "Указан неверный код из смс"}}},
"login": {
"login": "Вход",
"sms_auth": "SMS авторизация",
"input_code_confirm": "Введите код, полученный по SMS на номер",
"input_phone_num": "Введите номер телефона, на него мы отправим SMS с кодом доступа к личному кабинету",
"input_login_and_password": "Если у вас уже есть логин и пароль введите их ниже",
"code_confirm": "Код подтверждения",
"come_in": "Войти",
"sms_not_send_with_colon": "Если SMS не пришла, повторный код можно запросить через:",
"sms_not_send": "Если SMS не пришла, повторный код можно запросить через ",
"sms_not_send_next_try": "Если SMS не пришла вы можете",
"request_new_sms_code": "Запросить код повторно",
"change_phone_num": "Изменить номер телефона",
"get_code": "Получить код",
"or": "или",
"authorized_as": "Вы авторизовались как",
"come_in_with_login_and_pass": "Войдите с логином и паролем",
"phone_or_email": "Телефон или email",
"pass": "Пароль",
"come_in_with_sms_authorise": "Войдите через SMS авторизацию",
"errors": {
"incorrect_login_password": "Пользователя с таким логином или паролем не существует",
"undefined_error": "Произошла системная ошибка, попробуйте авторизоваться попозже"}},
"Jan": "января",
"Feb": "февраля",
"March": "марта",
"Mar": "марта",
"Apr": "апреля",
"May": "мая",
"Jun": "июня",
"Jul": "июля",
"Aug": "августа",
"Sep": "сентября",
"Oct": "октября",
"Nov": "ноября",
"Dec": "декабря",
"activity": {
"places_left": "Осталось мест",
"filters": {
"select": "Выберите фильтры",
"reset": "Сбросить",
"apply": "Применить"}},
"button": {
"select": "Выбрать",
"select_time": "Выбрать время",
"all_right": "Все верно",
"get_sms": "Получить СМС",
"back": "Вернуться",
"add_more": "Добавить еще",
"remove-from-record": "Удалить из заказа",
"continue": "Продолжить",
"confirm": "Подтвердить",
"canceling": "Отмена",
"more_reviews": "Еще отзывы"},
"landscape": "Будет удобнее, если повернуть устройство вертикально"}`

## [tag/Onlajn-zapis/operation/Отправить СМС код подтверждения номера телефона](https://developers.yclients.com/ru/\#tag/Onlajn-zapis/operation/%D0%9E%D1%82%D0%BF%D1%80%D0%B0%D0%B2%D0%B8%D1%82%D1%8C%20%D0%A1%D0%9C%D0%A1%20%D0%BA%D0%BE%D0%B4%20%D0%BF%D0%BE%D0%B4%D1%82%D0%B2%D0%B5%D1%80%D0%B6%D0%B4%D0%B5%D0%BD%D0%B8%D1%8F%20%D0%BD%D0%BE%D0%BC%D0%B5%D1%80%D0%B0%20%D1%82%D0%B5%D0%BB%D0%B5%D1%84%D0%BE%D0%BD%D0%B0) Отправить СМС код подтверждения номера телефона

post/book\_code/{company\_id}

https://api.yclients.com/api/v1/book\_code/{company\_id}

- Тело запроса
  - phone (required, string, '79991234567') - телефон, на который будет отправлен код
  - fullname (option, sring, `Вася`) \- Имя клиента

##### Authorizations:

_bearer_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:4564<br>ID компании |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| phone | string<br>Номер телефона клиента |
| fulname | string<br>Имя клиента |

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| meta | object<br>Метаданные |

### Request samples

- Payload

Content type

application/json

Copy

`{
"phone": "79991234567",
"fulname": "Вася"}`

### Response samples

- 201

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"meta": {
"message": "Created"}}`

## [tag/Onlajn-zapis/operation/Проверить параметры записи](https://developers.yclients.com/ru/\#tag/Onlajn-zapis/operation/%D0%9F%D1%80%D0%BE%D0%B2%D0%B5%D1%80%D0%B8%D1%82%D1%8C%20%D0%BF%D0%B0%D1%80%D0%B0%D0%BC%D0%B5%D1%82%D1%80%D1%8B%20%D0%B7%D0%B0%D0%BF%D0%B8%D1%81%D0%B8) Проверить параметры записи

post/book\_check/{company\_id}

https://api.yclients.com/api/v1/book\_check/{company\_id}

После формирования параметров записи(ей) можно проверить их на возможность создание записей.

JSON-Объект содержащий параметры онлайн записи имеет следующие поля:

| Поле | Тип | Обязательный | Описание |
| --- | --- | --- | --- |
| appointments | Массив объектов | ДА | Параметры записи (услуги, специалисты...) |

Массив appointments состоит из объектов, которые имеют следующие поля:

| Поле | Тип | Обязательный | Описание |
| --- | --- | --- | --- |
| id | number | Да | Идентификатор записи для обратной связи после сохранения (смотри ответ на запрос). |
| services | array of numbers | НЕТ | Массив идентификаторов услуг, на которые клиент хочет записаться |
| staff\_id | number | ДА | Идентификатор специалиста, к которому клиент хочет записаться (0 если выбран любой мастер) |
| datetime | datetime | ДА | Дата и время сеанса в формате ISO8601 (передается для каждого сеанса в ресурсе book\_times) |

В ответ на запрос проверки параметров придет пустой ответ с кодом 201 если параметры записи в порядке и записи могут быть созданы:

Если в ответ придет JSON с HTTP кодом отличным от 201, значит параметры записи не в порядке, а записи не могут быть созданы.

Ошибки, которые может вернуть сервер:

1. Выбранное время одной из записей уже занято.
В этом случае приходит ответ с http-кодом 422 и кодом ошибки 433,
а так же в поле id передается идентификатор записи из массива appointments

2. Нет сотрудников доступных для записи (если был выбран мастер по умолчанию).
В этом случае приходит ответ с http-кодом 422 и кодом ошибки 436

3. Выбранное время одной из записей пересекается с временем записи, создаваемой этим же запросом.
В этом случае приходит ответ с http-кодом 422 и кодом ошибки 437,
а так же в поле id передается идентификатор записи из массива appointments

4. Нет записи на указанную услуги. (Компания уже удалили выбранные услуги)
В этом случае приходит ответ с http-кодом 422 и кодом ошибки 438


##### Authorizations:

_bearer_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| appointments<br>required | Array of objects<br>Параметры записи (услуги, специалисты...) |

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| meta | object<br>Метаданные |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| meta | object<br>Метаданные |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"appointments": [\
{\
"id": 1,\
"services": [\
331],\
"staff_id": 6544,\
"datetime": 1443612600},\
{\
"id": 2,\
"services": [\
99055],\
"staff_id": 6544,\
"datetime": 1443614400}]}`

### Response samples

- 201
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"meta": {
"message": "Created"}}`

## [tag/Onlajn-zapis/operation/Создать запись на сеанс](https://developers.yclients.com/ru/\#tag/Onlajn-zapis/operation/%D0%A1%D0%BE%D0%B7%D0%B4%D0%B0%D1%82%D1%8C%20%D0%B7%D0%B0%D0%BF%D0%B8%D1%81%D1%8C%20%D0%BD%D0%B0%20%D1%81%D0%B5%D0%B0%D0%BD%D1%81) Создать запись на сеанс

post/book\_record/{company\_id}

https://api.yclients.com/api/v1/book\_record/{company\_id}

JSON-Объект содержащий параметры онлайн записи имеет следующие поля:

| Поле | Тип | Обязательный | Описание |
| --- | --- | --- | --- |
| phone | string | ДА | Телефон клиента (например 79161502239) |
| fullname | string | ДА | Имя клиента |
| email | string | ДА | Почтовый адрес клиента |
| appointments | Массив объектов | ДА | Параметры записи (услуги, специалисты...) |
| code | string | НЕТ | Код подтверждения номера телефона, высланный по СМС (нужен только в случае необходимости подтверждения номера) |
| notify\_by\_sms | number | НЕТ | За какое кол-во часов отправить смс напоминание о записи (0 если не нужно напоминать) |
| notify\_by\_email | number | НЕТ | За какое кол-во часов отправить email напоминание о записи (0 если не нужно напоминать) |
| comment | string | НЕТ | Комментарий к записи |
| api\_id | string | НЕТ | Внешний идентификатор записи |
| custom\_fields | key-value object | НЕТ | Значения дополнительных полей карточки клиента, которые сохраняются вместе с записью |

Массив appointments состоит из объектов, которые имеют следующие поля:

| Поле | Тип | Обязательный | Описание |
| --- | --- | --- | --- |
| id | number | Да | Идентификатор записи для обратной связи после сохранения (смотри ответ на запрос). |
| services | array of numbers | НЕТ | Массив идентификаторов услуг, на которые клиент хочет записаться |
| staff\_id | number | ДА | Идентификатор специалиста, к которому клиент хочет записаться (0 если выбран любой мастер) |
| datetime | datetime | ДА | Дата и время сеанса в формате ISO8601 (передается для каждого сеанса в ресурсе book\_times) |
| custom\_fields | key-value object | НЕТ | Значения дополнительных полей записи, которые сохраняются вместе с записью |

Дополнительные поля custom\_fields

При создании дополнительных полей записи и клиента (см. раздел "Дополнительные поля") становится возможным передавать собственные значения для полей.
Дополнительные поля уникальны для каждой компании. После создания дополнительных полей, их значения для конкретной записи могут
передаваться в необязательном поле custom\_fields в виде пар ключ-значение где ключ это поле "code" дополнительного поля. Пример:

- Создали дополнительное поле записи с code="my\_custom\_field" type="number", и второе поле code="some\_another\_field" type="list"
- Передали при создании записи в элементе массива appointments еще один атрибут:""
appointments: \[{\
...\
}, {\
...\
custom\_fields: {\
"my\_custom\_field": 123,\
"some\_another\_field": \["first value", "second value"\]\
}\
}\]"
- При получении данной записи методом GET впоследствии, это же значение дополнительных полей вернется в ответе

В ответ на запрос создания записи придет массив объектов (кол-во объектов равно кол-ву объектов в массиве appointments) со следующими полями:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | Идентификатор записи, переданный в массиве appointments |
| record\_id | number | Идентификатор созданной в системе записи |
| record\_hash | string | Идентификатор записи, для ее удаления непосредственно сразу после создания |

Ошибки, которые необходимо обрабатывать:

1. Введенный код подтверждения номера из SMS неправильный.
В этом случае приходит ответ с http-кодом 422 и кодом ошибки 432

2. Выбранное время одной из записей уже занято.
В этом случае приходит ответ с http-кодом 422 и кодом ошибки 433,
а так же в поле id передается идентификатор записи из массива appointments

3. Пользователь с указанным телефоном в черном списке и не может записываться.
В этом случае приходит ответ с http-кодом 403 и кодом ошибки 434

4. Номер телефона пользователя в неправильном формате.
В этом случае приходит ответ с http-кодом 422 и кодом ошибки 431

5. Не указано имя клиента.
В этом случае приходит ответ с http-кодом 422 и кодом ошибки 435

6. Нет сотрудников доступных для записи (если был выбран мастер по умолчанию).
В этом случае приходит ответ с http-кодом 422 и кодом ошибки 436

7. Выбранное время одной из записей пересекается с временем записи, создаваемой этим же запросом.
В этом случае приходит ответ с http-кодом 422 и кодом ошибки 437,
а так же в поле id передается идентификатор записи из массива appointments


##### Authorizations:

_bearer_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| phone<br>required | string<br>Телефон клиента |
| fullname<br>required | string<br>Имя клиента |
| email<br>required | string<br>Почтовый адрес клиента |
| code | number<br>Код подтверждения телефона, высланный по смс (обязателен если у компании выставлен phone\_conformation = true) |
| comment | string<br>Коммаентарий к записи |
| type | string<br>Источник записи |
| notify\_by\_sms | number<br>За сколько часов до визита следует выслать смс напоминание клиенту (0 - если не нужно) |
| notify\_by\_email | number<br>За сколько часов до визита следует выслать email напоминание клиенту (0 - если не нужно) |
| api\_id | number<br>ID записи из внешней системы |
| appointments | Array of objects<br>Параметры записей (сеанс, услуги, мастер) |

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Данные (массив объектов) |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"phone": "79000000000",
"fullname": "ДИМА",
"email": "d@yclients.com",
"code": "38829",
"comment": "тестовая запись!",
"type": "mobile",
"notify_by_sms": 6,
"notify_by_email": 24,
"api_id": "777",
"custom_fields": {
"my_client_custom_field": 789,
"some_another_client_field": [\
"first client value",\
"next client value"]},
"appointments": [\
{\
"id": 1,\
"services": [\
331],\
"staff_id": 6544,\
"datetime": "2025-01-01 12:00:00",\
"custom_fields": {\
"my_custom_field": 123,\
"some_another_field": [\
"first value",\
"next value"]}},\
{\
"id": 2,\
"services": [\
99055],\
"staff_id": 6544,\
"datetime": "2025-01-01 13:00:00",\
"custom_fields": {\
"my_custom_field": 456,\
"some_another_field": [\
"next value",\
"last value"]}}]}`

### Response samples

- 201

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 1,\
"record_id": 2820023,\
"record_hash": "567df655304da9b98487769426d4e76e"},\
{\
"id": 2,\
"record_id": 2820024,\
"record_hash": "34a45ddabdd446d5d33bdd27fbf855b2"}],
"meta": [ ]}`

## [tag/Onlajn-zapis/operation/Перенести запись на сеанс](https://developers.yclients.com/ru/\#tag/Onlajn-zapis/operation/%D0%9F%D0%B5%D1%80%D0%B5%D0%BD%D0%B5%D1%81%D1%82%D0%B8%20%D0%B7%D0%B0%D0%BF%D0%B8%D1%81%D1%8C%20%D0%BD%D0%B0%20%D1%81%D0%B5%D0%B0%D0%BD%D1%81) Перенести запись на сеанс

put/book\_record/{company\_id}/{record\_id}

https://api.yclients.com/api/v1/book\_record/{company\_id}/{record\_id}

##### Authorizations:

_bearer_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| record\_id<br>required | number<br>ID записи которую необходимо перенести |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| datetime | string<date-time><br>Дата и время на которое мы хотим перенести запись |
| comment | string<br>Комментарий к записи |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object<br>Данные (объект) |

### Request samples

- Payload

Content type

application/json

Copy

`{
"datetime": 1463754600,
"comment": "DODO!"}`

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 30358,
"services": [\
{\
"id": 2838,\
"title": "Массаж ног",\
"cost": 0,\
"discount": 0}],
"company": {
"id": 4564,
"title": "",
"country_id": "0",
"country": "",
"city_id": "0",
"city": "Москва",
"phone": "+7 916 684-41-22",
"timezone": "0",
"address": "",
"coordinate_lat": "0",
"coordinate_lon": "0"},
"staff": {
"id": 924,
"name": "Евгения",
"spec": "о ес",
"show_rating": "1",
"rating": "5",
"votes_count": "1",
"avatar": "https://yclients.com/images/no-master.png",
"comments_count": "0"},
"date": 1463754600,
"create_date": 1463668210,
"comment": "",
"deleted": true,
"length": 3600,
"notify_by_sms": 0,
"notify_by_email": 0,
"master_requested": false,
"online": true,
"api_id": "0"}}`

## [tag/Onlajn-zapis/operation/Получить запись на сеанс](https://developers.yclients.com/ru/\#tag/Onlajn-zapis/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D0%B7%D0%B0%D0%BF%D0%B8%D1%81%D1%8C%20%D0%BD%D0%B0%20%D1%81%D0%B5%D0%B0%D0%BD%D1%81) Получить запись на сеанс

get/book\_record/{company\_id}/{record\_id}/{record\_hash}

https://api.yclients.com/api/v1/book\_record/{company\_id}/{record\_id}/{record\_hash}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| record\_id<br>required | number<br>Example:22123<br>ID записи (достаточно для просмотра записи если пользователь авторизован) |
| record\_hash<br>required | string<br>Example:'dawd4fs09rhf0s9fafef0'<br>HASH записи (обязательно для просмотра записи если пользователь не авторизован) |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| id | number<br>ID записи |
| services | Array of objects<br>Список ID услуг |
| company | object<br>Параметры компании |
| staff | object<br>Параметры сотрудника |
| clients\_count | integer<int32> |
| date | string<date-time><br>"2025-01-01 12:00:00" (required, string) - Дата сеанса |
| datetime | string<date-time><br>Дата сеанса в ISO |
| create\_date | string<date-time><br>"2025-01-01 12:00:00" (required, string) - Дата создания записи |
| comment | string<br>Комментарий к записи |
| deleted | boolean<br>Удалена ли запись (true если удалена) |
| attendance | number<br>2 - Пользователь подтвердил запись, 1 - Пользователь пришел, услуги оказаны, 0 - ожидание пользователя, -1 - пользователь не пришел на визит |
| length | number<br>Длительность сеанса |
| notify\_by\_sms | number<br>За какое кол-во часов отправить смс напоминание о записи (0 если не нужно напоминать) |
| notify\_by\_email | number<br>За какое кол-во часов отправить email напоминание о записи (0 если не нужно напоминать) |
| master\_requested | boolean<br>Был ли указан определенный специалист при записи (false если был указан "не имеет значения") |
| online | boolean<br>Запись онлайновая или нет (false если запись внес администратор) |
| api\_id | string<br>Внешний идентификатор записи |
| last\_change\_date | string<date-time><br>Дата последнего редактирования записи |
| prepaid | boolean<br>Доступна ли онлайн-оплата для записи |
| prepaid\_confirmed | boolean<br>Статус online-оплаты |
| activity\_id | number<br>ID групповой записи |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"id": 13132699,
"services": [\
{\
"id": 389043,\
"title": "Коррекция нарощенных ногтей",\
"cost": 2300,\
"price_min": 2300,\
"price_max": 2300,\
"discount": 0,\
"amount": 1,\
"seance_length": 1800}],
"company": {
"id": 4564,
"title": "Салон корекции ногтей",
"country_id": 1,
"country": "Россия",
"city_id": 2,
"city": "Москва",
"phone": "+84 9 243 31 231",
"phones": [\
"+84 9 243 31 231",\
"+84 9 243 31 231"],
"timezone": 12,
"address": "ул. Образцова, 345",
"coordinate_lat": 54.786441,
"coordinate_lon": 37.608852,
"allow_delete_record": true,
"allow_change_record": true,
"site": "www.nogti.com",
"currency_short_title": "₽",
"allow_change_record_delay_step": 0,
"allow_delete_record_delay_step": 0},
"staff": {
"id": 55436,
"name": "Наталья",
"specialization": "Мастер маникюра и педикюра",
"position": {
"id": 446,
"title": "Мастер маникюра"},
"show_rating": 1,
"rating": 4.84,
"votes_count": 0,
"avatar": "http://example.com/image.png",
"comments_count": 37},
"clients_count": 1,
"date": "2017-10-24 17:30:00",
"datetime": "2017-10-24T17:30:00+0000",
"create_date": "2017-10-20T21:40:24+0000",
"comment": "",
"deleted": true,
"attendance": 0,
"length": 1800,
"notify_by_sms": 0,
"notify_by_email": 0,
"master_requested": false,
"online": true,
"api_id": "",
"last_change_date": "2017-10-24T23:54:02+0000",
"prepaid": false,
"prepaid_confirmed": false,
"activity_id": 0}`

## [tag/Onlajn-zapis/operation/Создать запись в групповом событии](https://developers.yclients.com/ru/\#tag/Onlajn-zapis/operation/%D0%A1%D0%BE%D0%B7%D0%B4%D0%B0%D1%82%D1%8C%20%D0%B7%D0%B0%D0%BF%D0%B8%D1%81%D1%8C%20%D0%B2%20%D0%B3%D1%80%D1%83%D0%BF%D0%BF%D0%BE%D0%B2%D0%BE%D0%BC%20%D1%81%D0%BE%D0%B1%D1%8B%D1%82%D0%B8%D0%B8) Создать запись в групповом событии

post/activity/{company\_id}/{activity\_id}/book

https://api.yclients.com/api/v1/activity/{company\_id}/{activity\_id}/book

##### Authorizations:

_bearer_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| activity\_id<br>required | number<br>ID группового события |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |

##### Request Body schema: \*/\*

|     |     |
| --- | --- |
| fullname<br>required | string<br>Имя клиента |
| phone<br>required | string<br>Телефон клиента (например 79161502239) |
| email | string<br>Почтовый адрес клиента |
| code | number<br>Код подтверждения телефона, высланный по смс (обязателен если у компании выставлен phone\_conformation = true) |
| comment | string<br>Комментарий к записи |
| notify\_by\_sms | integer<int32><br>За какое кол-во часов отправить смс напоминание о записи (0 если не нужно напоминать) |
| notify\_by\_email | integer<int32><br>За какое кол-во часов отправить email напоминание о записи (0 если не нужно напоминать) |
| type | string<br>Источник записи |
| api\_id | number<br>ID записи из внешней системы |
| clients\_count | number<br>количество занимаемых мест |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 28417878,
"hash": "9e6a54a1a9b118b65cc39ab6f3c3b5b4"},
"meta": [ ]}`

## [tag/Onlajn-zapis/operation/Получить список дат доступных для бронирования](https://developers.yclients.com/ru/\#tag/Onlajn-zapis/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%BE%D0%BA%20%D0%B4%D0%B0%D1%82%20%D0%B4%D0%BE%D1%81%D1%82%D1%83%D0%BF%D0%BD%D1%8B%D1%85%20%D0%B4%D0%BB%D1%8F%20%D0%B1%D1%80%D0%BE%D0%BD%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D1%8F) Получить список дат доступных для бронирования

get/book\_dates/{company\_id}

https://api.yclients.com/api/v1/book\_dates/{company\_id}

Объект даты, доступные для бронирования имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| working\_days | массив рабочих дней сгруппированных по месяцам | Рабочие дни сотрудника/организации |
| working\_dates | array of dates | Массив дат, когда работает сотрудник/организация |
| booking\_days | массив дней, когда есть свободные сеансы | Массив дней, которые доступны для бронирования на указанные услуги |
| booking\_dates | array of dates | Массив дат, когда есть свободные сеансы на услугу к выбранному сотруднику/организации |

working days и booking\_days имеют одинаковый формат:
месяц:\[массив дней в этом месяце\]

Например такой booking\_days:
"9": \[\
"4",\
"5"\]
"10": \[\
"14",\
"25"\]
Означает что на 4 и 5 сентября, и на 14 и 25 октября есть свободные сеансы для бронирования

Доступны следующие фильтры:

- service\_ids: Массив ID услуг. Если нужны даты, когда можно забронировать указанные услуги
- staff\_id: ID сотрудника. Если нужны даты, когда можно забронировать указанного специалиста
- date: Дата в рамках месяца, если нужны даты по конкретному месяцу

##### Authorizations:

_bearer_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### query Parameters

|     |     |
| --- | --- |
| service\_ids | Array of numbers<br>ID услуг. Фильтр по списку идентификаторов услуг.<br>Пример: `service_ids[]=123&service_ids[]=234`. |
| staff\_id | number<br>Example:staff\_id=0<br>ID сотрудника. Фильтр по идентификатору сотрудника<br>Default: 0 |
| date | string<br>Example:date=2015-09-01<br>дата в формате iso8601.<br>Фильтр по месяцу бронирования. |
| date\_from | string<br>Example:date\_from=2015-09-01<br>дата в формате iso8601.<br>Начало диапазона поиска.<br>Используется в паре с параметром "date\_to" и имеет приоритет перед параметром "date". |
| date\_to | string<br>Example:date\_to=2015-09-30<br>дата в формате iso8601.<br>Окончание диапазона поиска.<br>Используется в паре с параметром "date\_from" и имеет приоритет перед параметром "date". |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object<br>Данные (объект) |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"booking_days": {
"9": [\
"4",\
"5",\
"8",\
"9",\
"12",\
"13",\
"16",\
"17",\
"20",\
"21",\
"24",\
"25",\
"28",\
"29",\
"30"],
"10": [\
"1",\
"4",\
"5",\
"8",\
"9",\
"12",\
"13",\
"16",\
"17",\
"20",\
"21",\
"24",\
"25"]},
"booking_dates": [\
1441324800,\
1441411200,\
1441670400,\
1441756800,\
1442016000,\
1442102400,\
1442361600,\
1442448000,\
1442707200,\
1442793600,\
1443052800,\
1443139200,\
1443398400,\
1443484800,\
1443571200,\
1443657600,\
1443916800,\
1444003200,\
1444262400,\
1444348800,\
1444608000,\
1444694400,\
1444953600,\
1445040000,\
1445299200,\
1445385600,\
1445644800,\
1445731200],
"working_days": {
"9": [\
"4",\
"5",\
"8",\
"9",\
"12",\
"13",\
"16",\
"17",\
"20",\
"21",\
"24",\
"25",\
"28",\
"29",\
"30"],
"10": [\
"1",\
"4",\
"5",\
"8",\
"9",\
"12",\
"13",\
"16",\
"17",\
"20",\
"21",\
"24",\
"25"]},
"working_dates": [\
1441324800,\
1441411200,\
1441670400,\
1441756800,\
1442016000,\
1442102400,\
1442361600,\
1442448000,\
1442707200,\
1442793600,\
1443052800,\
1443139200,\
1443398400,\
1443484800,\
1443571200,\
1443657600,\
1443916800,\
1444003200,\
1444262400,\
1444348800,\
1444608000,\
1444694400,\
1444953600,\
1445040000,\
1445299200,\
1445385600,\
1445644800,\
1445731200]},
"meta": [ ]}`

## [tag/Onlajn-zapis/operation/Получить список услуг доступных для бронирования](https://developers.yclients.com/ru/\#tag/Onlajn-zapis/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%BE%D0%BA%20%D1%83%D1%81%D0%BB%D1%83%D0%B3%20%D0%B4%D0%BE%D1%81%D1%82%D1%83%D0%BF%D0%BD%D1%8B%D1%85%20%D0%B4%D0%BB%D1%8F%20%D0%B1%D1%80%D0%BE%D0%BD%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D1%8F) Получить список услуг доступных для бронирования

get/book\_services/{company\_id}

https://api.yclients.com/api/v1/book\_services/{company\_id}

Объект услуг, доступных для бронирования имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| categories | массив объектов | Массив категорий услуг (забронировать категорию нельзя) |
| services | массив объектов | Услуги, доступные для бронирования, с указанием категории |

Объект из массива categories, имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | Идентификатор категории |
| title | string | Название категории |
| sex | number | Принадлежность категории к полу (1 - мужской, 2 - женский, 0 - не задано) |
| weight | number | Вес категории. При выводе категории сортируются по весу, сначала более тяжелые |
| api\_id | string | Внешний идентификатор категории |

Объект из массива services, имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | Идентификатор услуги |
| title | string | Название услуги |
| category\_id | number | Идентификатор категории, которой принадлежит услуга |
| weight | number | Вес категории. При выводе услуги сортируются по весу, сначала более тяжелые |
| price\_min | number | Минимальная стоимость услуги |
| price\_max | number | Максимальная стоимость услуги |
| discount | number | Скидка по услуге |
| comment | string | Комментарий к услуге |
| active | number | Активная ли услуга |
| prepaid | string | Статус онлайн-оплаты |
| sex | number | Пол, для которого оказывается услуга |
| seance\_length | number | Длительность оказания услуги в секундах (только если задан фильтр по сотруднику) |
| image | string | Изображение услуги |

Если необходимо получить услуги, которые оказывает конкретный специалист, то нужно воспользоваться фильтром по специалисту.
Доступны следующие фильтры:

- staff\_id: ID сотрудника. Если нужны услуги, которые оказывает только выбранный сотрудник
- datetime: дата (в формате iso8601). Если нужны услуги, которые можно забронировать у мастера на определенное время
- service\_ids: Массив ID услуг. Если уже выбран мастер, время и услуга(и) в рамках этой записи, и необходимо выбрать еще услугу.

##### Authorizations:

_bearer_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:4564<br>ID компании |

##### query Parameters

|     |     |
| --- | --- |
| staff\_id | number<br>Example:staff\_id=0<br>ID сотрудника. Фильтр по идентификатору сотрудника<br>Default: 0 |
| datetime | number<br>Example:datetime=\`\`<br>дата (в формате iso8601). Фильтр по дате бронирования услуги (например '2005-09-09T18:30')<br>Default: '' |
| service\_ids | Array of numbers<br>ID услуг. Фильтр по списку идентификаторов услуг.<br>Пример: `service_ids[]=123&service_ids[]=234`. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успшности выполнения (true) |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"events": [ ],
"services": [\
{\
"id": 1896208,\
"title": "Мытье волос",\
"category_id": 1895571,\
"price_min": 0,\
"price_max": 0,\
"discount": 0,\
"comment": "",\
"weight": 0,\
"active": 0,\
"sex": 0,\
"image": "",\
"prepaid": "forbidden",\
"seance_length": 3600},\
{\
"id": 1896303,\
"title": "Окрашивание",\
"category_id": 1895574,\
"price_min": 0,\
"price_max": 0,\
"discount": 0,\
"comment": "",\
"weight": 0,\
"active": 0,\
"sex": 0,\
"image": "",\
"prepaid": "forbidden",\
"seance_length": 3600}],
"category": [\
{\
"id": 1895571,\
"title": "Уходы для волос",\
"sex": 0,\
"api_id": 0,\
"weight": 60},\
{\
"id": 1895574,\
"title": "Окрашивание волос",\
"sex": 0,\
"api_id": 0,\
"weight": 7}]},
"meta": [ ]}`

## [tag/Onlajn-zapis/operation/Получить список ближайших доступных сеансов](https://developers.yclients.com/ru/\#tag/Onlajn-zapis/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%BE%D0%BA%20%D0%B1%D0%BB%D0%B8%D0%B6%D0%B0%D0%B9%D1%88%D0%B8%D1%85%20%D0%B4%D0%BE%D1%81%D1%82%D1%83%D0%BF%D0%BD%D1%8B%D1%85%20%D1%81%D0%B5%D0%B0%D0%BD%D1%81%D0%BE%D0%B2) Получить список ближайших доступных сеансов

get/book\_staff\_seances/{company\_id}/{staff\_id}/

https://api.yclients.com/api/v1/book\_staff\_seances/{company\_id}/{staff\_id}/

Объект ближайших сеансов сотрудника имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| seance\_date | string | Ближайшая дата с доступными сеансами |
| seances | Array | Список доступных сеансов |

##### Authorizations:

_bearer_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| staff\_id<br>required | number<br>ID сотрудника |

##### query Parameters

|     |     |
| --- | --- |
| service\_ids | Array of numbers<br>ID услуг. Фильтр по списку идентификаторов услуг.<br>Пример: `service_ids[]=123&service_ids[]=234`. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"seance_date": 1492041600,
"seances": [\
{\
"time": "10:00",\
"seance_length": 3600,\
"datetime": 1492063200},\
{\
"time": "10:15",\
"seance_length": 3600,\
"datetime": 1492064100},\
{\
"time": "10:30",\
"seance_length": 3600,\
"datetime": 1492065000},\
{\
"time": "10:45",\
"seance_length": 3600,\
"datetime": 1492065900},\
{\
"time": "11:00",\
"seance_length": 3600,\
"datetime": 1492066800}]},
"meta": [ ]}`

## [tag/Onlajn-zapis/operation/Получить список сотрудников доступных для бронирования](https://developers.yclients.com/ru/\#tag/Onlajn-zapis/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%BE%D0%BA%20%D1%81%D0%BE%D1%82%D1%80%D1%83%D0%B4%D0%BD%D0%B8%D0%BA%D0%BE%D0%B2%20%D0%B4%D0%BE%D1%81%D1%82%D1%83%D0%BF%D0%BD%D1%8B%D1%85%20%D0%B4%D0%BB%D1%8F%20%D0%B1%D1%80%D0%BE%D0%BD%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D1%8F) Получить список сотрудников доступных для бронирования

get/book\_staff/{company\_id}

https://api.yclients.com/api/v1/book\_staff/{company\_id}

Каждый объект из массива сотрудников, доступных для бронирования имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | Идентификатор сотрудника |
| name | string | Имя сотрудника |
| specialization | string | Специализация сотрудника |
| position | object | Должность сотрудника |
| bookable | boolean | Есть ли у сотрудника сеансы, доступные для бронирования |
| weight | number | Вес сотрудника. При выводе сотрудники сортируются по весу, сначала более тяжелые |
| show\_rating | number | Показывать ли рейтинг сотрудника (1 - показывать, 0 - не показывать) |
| rating | number | Рейтинг сотрудника |
| votes\_count | number | Кол-во голосов, оценивших сотрудника |
| comments\_count | number | Кол-во комментариев к сотруднику |
| avatar | string | Путь к файлу аватарки сотрудника |
| information | string | Дополнительная информация о сотруднике (HTML формат) |
| seance\_date | string | Дата ближайшего дня, на который есть доступные сеансы (только для bookable = true) |

Доступны следующие фильтры:

- service\_ids: Массив ID услуг. Если нужны сотрудники, которые оказывают только выбранную услугу
- datetime: дата (в формате iso8601). Если нужны сотрудники, у которых есть сеансы на указанную услугу в указанное время

##### Authorizations:

_bearer_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:4564<br>ID компании |

##### query Parameters

|     |     |
| --- | --- |
| service\_ids | Array of numbers<br>ID услуг. Фильтр по списку идентификаторов услуг.<br>Пример: `service_ids[]=123&service_ids[]=234`. |
| datetime | number<br>дата в формате iso8601.<br>Фильтр по дате бронирования услуги (например '2005-09-09T18:30') |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": "16",\
"name": "Вася",\
"bookable": true,\
"specialization": "Фельдшер",\
"position": {\
"id": 1,\
"title": "Администратор"},\
"show_rating": "1",\
"rating": "3",\
"votes_count": "1",\
"avatar": "https://yclients.com/images/no-master.png",\
"comments_count": "0",\
"weight": "11",\
"information": "<span></span>",\
"seance_date": 1443139200,\
"seances": [ ]},\
{\
"id": "32",\
"name": "Петя",\
"bookable": false,\
"specialization": "Терапевт",\
"position": [ ],\
"show_rating": "1",\
"rating": "4",\
"votes_count": "1",\
"avatar": "https://yclients.com/images/no-master.png",\
"comments_count": "0",\
"weight": "8",\
"information": "<span></span>"}],
"meta": [ ]}`

## [tag/Onlajn-zapis/operation/Получить список сеансов доступных для бронирования](https://developers.yclients.com/ru/\#tag/Onlajn-zapis/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%BE%D0%BA%20%D1%81%D0%B5%D0%B0%D0%BD%D1%81%D0%BE%D0%B2%20%D0%B4%D0%BE%D1%81%D1%82%D1%83%D0%BF%D0%BD%D1%8B%D1%85%20%D0%B4%D0%BB%D1%8F%20%D0%B1%D1%80%D0%BE%D0%BD%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D1%8F) Получить список сеансов доступных для бронирования

get/book\_times/{company\_id}/{staff\_id}/{date}

https://api.yclients.com/api/v1/book\_times/{company\_id}/{staff\_id}/{date}

Объект сеансы, доступные для бронирования имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| time | string | Время сеанса (17:30 например) |
| seance\_length | number | Длительность сеанса в секундах |
| datetime | datetime | Дата и время сеанса в формате ISO8601 (нужно передавать при создании записи) |

Доступны следующие фильтры:

- service\_ids: Массив ID услуг. Если нужны сеансы, когда можно забронировать указанные услуги

##### Authorizations:

_bearer_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| date<br>required | string<br>дата в формате iso8601.<br>Фильтр по дате бронирования (например '2015-09-30') |
| staff\_id<br>required | number<br>Example:0<br>ID сотрудника. Фильтр по идентификатору сотрудника<br>Default: 0 |

##### query Parameters

|     |     |
| --- | --- |
| service\_ids | Array of numbers<br>ID услуг. Фильтр по списку идентификаторов услуг.<br>Пример: `service_ids[]=123&service_ids[]=234`. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"time": "12:00",\
"seance_length": 3600,\
"datetime": 1443513600},\
{\
"time": "13:00",\
"seance_length": 3600,\
"datetime": 1443517200},\
{\
"time": "14:00",\
"seance_length": 3600,\
"datetime": 1443520800},\
{\
"time": "15:00",\
"seance_length": 3600,\
"datetime": 1443524400},\
{\
"time": "16:00",\
"seance_length": 3600,\
"datetime": 1443528000}],
"meta": [ ]}`

## [tag/Onlajn-zapis/operation/api.location.settings.timeslots.read](https://developers.yclients.com/ru/\#tag/Onlajn-zapis/operation/api.location.settings.timeslots.read) Получить настройки таймслотов филиала

get/company/{company\_id}/settings/timeslots

https://api.yclients.com/api/v1/company/{company\_id}/settings/timeslots

Получение настроек таймслотов филиала. Интервалы слотов указываются в секундах, в ответе возвращаются настройки по каждому дню недели.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object<br>Объект модели "Настройки таймслотов". |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

### Response samples

- 200
- 401
- 403
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"is_enabled": true,
"weekdays_settings": [\
{\
"weekday": 1,\
"timeslots": [\
7200,\
14400],\
"setting": {\
"grid_first_timeslot": 0,\
"grid_last_timeslot": 85800,\
"grid_display_step": 7200,\
"grid_nearest_timeslot_delay": 1800,\
"grid_base_type": "predefined",\
"is_grid_flexible": false}},\
{\
"weekday": 2,\
"timeslots": [\
50400,\
57600],\
"setting": {\
"grid_first_timeslot": 0,\
"grid_last_timeslot": 85800,\
"grid_display_step": 7200,\
"grid_nearest_timeslot_delay": 1800,\
"grid_base_type": "predefined",\
"is_grid_flexible": false}},\
{\
"weekday": 3,\
"timeslots": [\
7200,\
14400],\
"setting": {\
"grid_first_timeslot": 0,\
"grid_last_timeslot": 85800,\
"grid_display_step": 7200,\
"grid_nearest_timeslot_delay": 1800,\
"grid_base_type": "predefined",\
"is_grid_flexible": false}},\
{\
"weekday": 4,\
"timeslots": [\
50400,\
57600],\
"setting": {\
"grid_first_timeslot": 0,\
"grid_last_timeslot": 85800,\
"grid_display_step": 7200,\
"grid_nearest_timeslot_delay": 1800,\
"grid_base_type": "predefined",\
"is_grid_flexible": false}},\
{\
"weekday": 5,\
"timeslots": [\
7200,\
14400],\
"setting": {\
"grid_first_timeslot": 0,\
"grid_last_timeslot": 85800,\
"grid_display_step": 7200,\
"grid_nearest_timeslot_delay": 1800,\
"grid_base_type": "predefined",\
"is_grid_flexible": false}},\
{\
"weekday": 6,\
"timeslots": [\
50400,\
57600],\
"setting": {\
"grid_first_timeslot": 0,\
"grid_last_timeslot": 85800,\
"grid_display_step": 7200,\
"grid_nearest_timeslot_delay": 1800,\
"grid_base_type": "predefined",\
"is_grid_flexible": false}},\
{\
"weekday": 7,\
"timeslots": [\
79200,\
81000],\
"setting": {\
"grid_first_timeslot": 0,\
"grid_last_timeslot": 85800,\
"grid_display_step": 7200,\
"grid_nearest_timeslot_delay": 1800,\
"grid_base_type": "predefined",\
"is_grid_flexible": false}}],
"dates_settings": {
"date": "2024-08-31",
"timeslots": [ ],
"setting": {
"grid_first_timeslot": 0,
"grid_last_timeslot": 85800,
"grid_display_step": 7200,
"grid_nearest_timeslot_delay": 1800,
"grid_base_type": "predefined",
"is_grid_flexible": false}}},
"meta": { }}`

# [tag/Zapisi-polzovatelya](https://developers.yclients.com/ru/\#tag/Zapisi-polzovatelya) Записи пользователя

Для управлениями записями пользователя используются следующие методы

## [tag/Zapisi-polzovatelya/operation/Авторизоваться по номеру телефона и коду](https://developers.yclients.com/ru/\#tag/Zapisi-polzovatelya/operation/%D0%90%D0%B2%D1%82%D0%BE%D1%80%D0%B8%D0%B7%D0%BE%D0%B2%D0%B0%D1%82%D1%8C%D1%81%D1%8F%20%D0%BF%D0%BE%20%D0%BD%D0%BE%D0%BC%D0%B5%D1%80%D1%83%20%D1%82%D0%B5%D0%BB%D0%B5%D1%84%D0%BE%D0%BD%D0%B0%20%D0%B8%20%D0%BA%D0%BE%D0%B4%D1%83) Авторизоваться по номеру телефона и коду

post/user/auth

https://api.yclients.com/api/v1/user/auth

Для доступа к своим онлайн и оффлайн (сделанным по телефону) записям пользователь должен авторизоваться подтвердив свой номер телефона. Для этого ему нужно выслать на свой номер телефона код подтверждения с помощью ресурса "СМС код подтверждения номера телефона

##### Authorizations:

_bearer_

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| login<br>required | string<br>Номер телефона или Email |
| password<br>required | string<br>Пароль |

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| user\_token | string<br>User\_token пользователя |

### Request samples

- Payload

Content type

application/json

Copy

`{
"login": "testuser@yclients.com",
"password": "testpass"}`

### Response samples

- 201

Content type

application/json

Copy

`{
"user_token": "wec23fh8cDfFV4432fc352456"}`

## [tag/Zapisi-polzovatelya/operation/Получить записи пользователя](https://developers.yclients.com/ru/\#tag/Zapisi-polzovatelya/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D0%B7%D0%B0%D0%BF%D0%B8%D1%81%D0%B8%20%D0%BF%D0%BE%D0%BB%D1%8C%D0%B7%D0%BE%D0%B2%D0%B0%D1%82%D0%B5%D0%BB%D1%8F) Получить записи пользователя

get/user/records/{record\_id}/{record\_hash}

https://api.yclients.com/api/v1/user/records/{record\_id}/{record\_hash}

JSON-Объект содержащий параметры записи пользователя имеет следующие поля:

| Поле | Тип | Обязательный | Описание |
| --- | --- | --- | --- |
| id | number | ДА | ID записи |
| services | array of numbers | ДА | Список ID услуг записи |
| company | object | ДА | Параметры компании |
| staff | object | ДА | Параметры специалиста, которые был забронирован |
| clients\_count | int | ДА | Количество клиентов |
| date | string | ДА | Дата сеанса |
| datetime | string | ДА | Дата сеанса в формате |
| create\_date | string | ДА | Дата создания записи |
| length | number | ДА | Длительность сеанса |
| deleted | boolean | ДА | Удалена ли запись (true если удалена) |
| notify\_by\_sms | number | НЕТ | За какое кол-во часов отправить смс напоминание о записи (0 если не нужно напоминать) |
| notify\_by\_email | number | НЕТ | За какое кол-во часов отправить email напоминание о записи (0 если не нужно напоминать) |
| comment | string | ДА | Комментарий к записи |
| master\_requested | boolean | ДА | Был ли указан определенный специалист при записи (false если был указан "не имеет значения") |
| online | boolean | ДА | Запись онлайновая или нет (false если запись внес администратор) |
| visit\_attendance | number | ДА | 2 - Пользователь подтвердил запись, 1 - Пользователь пришел, услуги оказаны, 0 - ожидание пользователя, -1 - пользователь не пришел на визит |
| api\_id | string | НЕТ | Внешний идентификатор записи |
| last\_change\_date | string | НЕТ | Дата последнего редактирования записи |
| prepaid | boolean | НЕТ | Доступна ли онлайн-оплата для записи |
| prepaid\_confirmed | boolean | НЕТ | Статус online-оплаты |
| last\_change\_date | string | НЕТ | Дата последнего редактирования записи |
| activity\_id | int | НЕТ | ID чего групповой записи |

Каждый объект из массива services имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | Идентификатор услуги |
| title | string | Название услуги |
| cost | float | Стоимость услуги |
| price\_min | float | Минимальная цена услуги |
| price\_max | float | Максимальная цена услуги |
| discount | float | Скидка |
| amount | int | Количество заказанных услуг |
| seance\_length | int | Длительность оказания услуги в секундах (только если задан фильтр по сотруднику) |

Объект company имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | Идентификатор компании |
| title | string | Название компании |
| country\_id | number | Идентификатор страны, в которой расположена компания |
| country | string | Название старны компании |
| city\_id | number | Идентификатор города, в котором расположена компания) |
| city | string | Название города компании |
| timezone | string | Timezone компании |
| address | string | Адрес, по которому расположена компания |
| phone | string | Основной номер телефона компании |
| phones | array of strings | Все номера телефонов компании |
| coordinate\_lat | float | Широта, на которой расположена компания |
| coordinate\_lng | float | Долгота |
| allow\_delete\_record | boolean | Можно ли удалять запись |
| allow\_change\_record | boolean | Можно ли переносить запись |
| site | string | Сайт компании |
| currency\_short\_title | string | Символ валюты |
| allow\_change\_record\_delay\_step | int | Время, через которое можно переносить запись |
| allow\_delete\_record\_delay\_step | int | Время, через которое можно удалять запись |

Объект staff имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | Идентификатор сотрудника |
| name | string | Имя сотрудника |
| specialization | string | Специализация сотрудника |
| position | object | Должность сотрудника |
| show\_rating | number | Показывать ли рейтинг сотрудника (1 - показывать, 0 - не показывать) |
| rating | number | Рейтинг сотрудника |
| votes\_count | number | Кол-во голосов, оценивших сотрудника |
| comments\_count | number | Кол-во комментариев к сотруднику |
| avatar | string | Путь к файлу аватарки сотрудника |

##### Authorizations:

(_bearer__user_)

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 201

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 13132699,\
"services": [\
{\
"id": 389043,\
"title": "Коррекция нарощенных ногтей",\
"cost": 2300,\
"price_min": 2300,\
"price_max": 2300,\
"discount": 0,\
"amount": 1,\
"seance_length": 1800}],\
"company": {\
"id": 4564,\
"title": "Салон корекции ногтей",\
"country_id": 1,\
"country": "Россия",\
"city_id": 2,\
"city": "Москва",\
"phone": "+84 9 243 31 231",\
"phones": [\
"+84 9 243 31 231",\
"+84 9 243 31 231"],\
"timezone": 12,\
"address": "ул. Образцова, 345",\
"coordinate_lat": 54.786441,\
"coordinate_lon": 37.608852,\
"allow_delete_record": true,\
"allow_change_record": true,\
"site": "www.nogti.com",\
"currency_short_title": "₽",\
"allow_change_record_delay_step": 0,\
"allow_delete_record_delay_step": 0},\
"staff": {\
"id": 55436,\
"name": "Наталья",\
"specialization": "Мастер маникюра и педикюра",\
"position": {\
"id": 446,\
"title": "Мастер маникюра"},\
"show_rating": 1,\
"rating": 4.84,\
"votes_count": 0,\
"avatar": "http://example.com/image.png",\
"comments_count": 37},\
"clients_count": 1,\
"date": "2017-10-24 17:30:00",\
"datetime": "2017-10-24T17:30:00+0000",\
"create_date": "2017-10-20T21:40:24+0000",\
"comment": "",\
"deleted": true,\
"attendance": 0,\
"length": 1800,\
"notify_by_sms": 0,\
"notify_by_email": 0,\
"master_requested": false,\
"online": true,\
"api_id": "",\
"last_change_date": "2017-10-24T23:54:02+0000",\
"prepaid": false,\
"prepaid_confirmed": false,\
"activity_id": 0},\
{\
"id": 13133413,\
"services": [\
{\
"id": 389045,\
"title": "Массаж рук (10 мин)",\
"cost": 300,\
"price_min": 300,\
"price_max": 400,\
"discount": 0,\
"amount": 1,\
"seance_length": 1800}],\
"company": {\
"id": 4564,\
"title": "Салон корекции ногтей",\
"country_id": 1,\
"country": "Россия",\
"city_id": 2,\
"city": "Москва",\
"phone": "+84 9 243 31 231",\
"phones": [\
"+84 9 243 31 231",\
"+84 9 243 31 231"],\
"timezone": 12,\
"address": "ул. Образцова, 345",\
"coordinate_lat": 54.786441,\
"coordinate_lon": 37.608852,\
"allow_delete_record": true,\
"allow_change_record": true,\
"site": "www.nogti.com",\
"currency_short_title": "₽",\
"allow_change_record_delay_step": 0,\
"allow_delete_record_delay_step": 0},\
"staff": {\
"id": 55436,\
"name": "Наталья",\
"specialization": "Мастер маникюра и педикюра",\
"position": {\
"id": 446,\
"title": "Мастер маникюра"},\
"show_rating": 1,\
"rating": 4.84,\
"votes_count": 0,\
"avatar": "http://example.com/image.png",\
"comments_count": 37},\
"clients_count": 1,\
"date": "2017-10-24 17:30:00",\
"datetime": "2017-10-24T17:30:00+0000",\
"create_date": "2017-10-20T21:40:24+0000",\
"comment": "",\
"deleted": true,\
"attendance": 0,\
"length": 1800,\
"notify_by_sms": 0,\
"notify_by_email": 0,\
"master_requested": false,\
"online": true,\
"api_id": "",\
"last_change_date": "2017-10-24T23:54:02+0000",\
"prepaid": false,\
"prepaid_confirmed": false,\
"activity_id": 0}],
"meta": [ ]}`

## [tag/Zapisi-polzovatelya/operation/Удалить запись пользователя](https://developers.yclients.com/ru/\#tag/Zapisi-polzovatelya/operation/%D0%A3%D0%B4%D0%B0%D0%BB%D0%B8%D1%82%D1%8C%20%D0%B7%D0%B0%D0%BF%D0%B8%D1%81%D1%8C%20%D0%BF%D0%BE%D0%BB%D1%8C%D0%B7%D0%BE%D0%B2%D0%B0%D1%82%D0%B5%D0%BB%D1%8F) Удалить запись пользователя

delete/user/records/{record\_id}/{record\_hash}

https://api.yclients.com/api/v1/user/records/{record\_id}/{record\_hash}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| record\_id<br>required | number<br>Example:22123<br>ID записи (достаточно для удаления записи если пользователь авторизован) |
| record\_hash<br>required | string<br>Example:'dawd4fs09rhf0s9fafef0'<br>HASH записи (обязательно для удаления записи если пользователь не авторизован) |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

# [tag/Polzovateli-onlajn-zapisi](https://developers.yclients.com/ru/\#tag/Polzovateli-onlajn-zapisi) Пользователи онлайн-записи

Пользователи клиентской части онлайн-записи.

## [tag/Polzovateli-onlajn-zapisi/operation/Авторизовать пользователя онлайн-записи](https://developers.yclients.com/ru/\#tag/Polzovateli-onlajn-zapisi/operation/%D0%90%D0%B2%D1%82%D0%BE%D1%80%D0%B8%D0%B7%D0%BE%D0%B2%D0%B0%D1%82%D1%8C%20%D0%BF%D0%BE%D0%BB%D1%8C%D0%B7%D0%BE%D0%B2%D0%B0%D1%82%D0%B5%D0%BB%D1%8F%20%D0%BE%D0%BD%D0%BB%D0%B0%D0%B9%D0%BD-%D0%B7%D0%B0%D0%BF%D0%B8%D1%81%D0%B8) Авторизовать пользователя онлайн-записи

post/booking/auth

https://api.yclients.com/api/v1/booking/auth

При смене пароля пользователем онлайн-записи его API-ключ изменится и потребуется новая авторизация

| Атрибут | Тип | Описание |
| --- | --- | --- |
| login | string | В качестве логина может быть использован номер телефона посетителя в формате 79161234567 или его Email |
| password | string | Пароль посетителя |

##### Authorizations:

_bearer_

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| login<br>required | string<br>Номер телефона или Email |
| password<br>required | string<br>Пароль |

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| id | integer<int32><br>Идентификатор пользователя |
| user\_token | string<br>User\_token пользователя |
| name | string<br>Имя пользователя |
| phone | string<br>Телефон пользователя |
| login | string<br>Логин пользователя |
| email | string<br>Почтовый адрес пользователя |
| avatar | string<br>Путь к файлу аватарки пользователя |

### Request samples

- Payload

Content type

application/json

Copy

`{
"login": "testuser@yclients.com",
"password": "testpass"}`

### Response samples

- 201

Content type

application/json

Copy

`{
"id": 123456,
"user_token": "wec23fh8cDfFV4432fc352456",
"name": "Иван Попов",
"phone": "79161001010",
"login": "79161001010",
"email": "test@test.com",
"avatar": "https://assets.yclients.com/general/0/01/123456789098765_12345678909876.png"}`

## [tag/Polzovateli-onlajn-zapisi/operation/Отправить СМС код подтверждения номера телефона для изменения данных](https://developers.yclients.com/ru/\#tag/Polzovateli-onlajn-zapisi/operation/%D0%9E%D1%82%D0%BF%D1%80%D0%B0%D0%B2%D0%B8%D1%82%D1%8C%20%D0%A1%D0%9C%D0%A1%20%D0%BA%D0%BE%D0%B4%20%D0%BF%D0%BE%D0%B4%D1%82%D0%B2%D0%B5%D1%80%D0%B6%D0%B4%D0%B5%D0%BD%D0%B8%D1%8F%20%D0%BD%D0%BE%D0%BC%D0%B5%D1%80%D0%B0%20%D1%82%D0%B5%D0%BB%D0%B5%D1%84%D0%BE%D0%BD%D0%B0%20%D0%B4%D0%BB%D1%8F%20%D0%B8%D0%B7%D0%BC%D0%B5%D0%BD%D0%B5%D0%BD%D0%B8%D1%8F%20%D0%B4%D0%B0%D0%BD%D0%BD%D1%8B%D1%85) Отправить СМС код подтверждения номера телефона для изменения данных

get/booking/user/phone\_confirmation

https://api.yclients.com/api/v1/booking/user/phone\_confirmation

В запросе должен обязательно присутствовать один из двух параметров: company\_id или group\_id

##### Authorizations:

(_bearer__user_)

##### query Parameters

|     |     |
| --- | --- |
| company\_id<br>required | integer<br>Идентификатор компании |
| group\_id<br>required | integer<br>Идентификатор сети |
| phone<br>required | string<br>Номер телефона |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**202**
Accepted

### Response samples

- 202

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"meta": {
"message": "Accepted"}}`

## [tag/Polzovateli-onlajn-zapisi/operation/Обновление пароля пользователя онлайн-записи](https://developers.yclients.com/ru/\#tag/Polzovateli-onlajn-zapisi/operation/%D0%9E%D0%B1%D0%BD%D0%BE%D0%B2%D0%BB%D0%B5%D0%BD%D0%B8%D0%B5%20%D0%BF%D0%B0%D1%80%D0%BE%D0%BB%D1%8F%20%D0%BF%D0%BE%D0%BB%D1%8C%D0%B7%D0%BE%D0%B2%D0%B0%D1%82%D0%B5%D0%BB%D1%8F%20%D0%BE%D0%BD%D0%BB%D0%B0%D0%B9%D0%BD-%D0%B7%D0%B0%D0%BF%D0%B8%D1%81%D0%B8) Обновление пароля пользователя онлайн-записи

put/booking/user/password

https://api.yclients.com/api/v1/booking/user/password

Обновление пароля пользователя онлайн-записи.

В ответе приходит новый токен пользователя.

##### Authorizations:

(_bearer__user_)

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| old\_password | string<br>Текущий пароль |
| new\_password | string<br>Новый пароль |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Request samples

- Payload

Content type

application/json

Copy

`{
"old_password": "qwerty123",
"new_password": "example!"}`

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"user_token": "4de9d8cc108c0"},
"meta": [ ]}`

## [tag/Polzovateli-onlajn-zapisi/operation/Обновление пользователя онлайн-записи](https://developers.yclients.com/ru/\#tag/Polzovateli-onlajn-zapisi/operation/%D0%9E%D0%B1%D0%BD%D0%BE%D0%B2%D0%BB%D0%B5%D0%BD%D0%B8%D0%B5%20%D0%BF%D0%BE%D0%BB%D1%8C%D0%B7%D0%BE%D0%B2%D0%B0%D1%82%D0%B5%D0%BB%D1%8F%20%D0%BE%D0%BD%D0%BB%D0%B0%D0%B9%D0%BD-%D0%B7%D0%B0%D0%BF%D0%B8%D1%81%D0%B8) Обновление данных пользователя онлайн-записи

put/booking/user

https://api.yclients.com/api/v1/booking/user

Обновление основных данных пользователя онлайн-записи.

При обновлении номера телефона нужно отправлять поле confirmation\_code с кодом, который нужно получить
из ресурса [СМС код подтверждения номера телефона для изменения\\
данных](https://developers.yclients.com/ru/#operation/%D0%9E%D1%82%D0%BF%D1%80%D0%B0%D0%B2%D0%B8%D1%82%D1%8C%20%D0%A1%D0%9C%D0%A1%20%D0%BA%D0%BE%D0%B4%20%D0%BF%D0%BE%D0%B4%D1%82%D0%B2%D0%B5%D1%80%D0%B6%D0%B4%D0%B5%D0%BD%D0%B8%D1%8F%20%D0%BD%D0%BE%D0%BC%D0%B5%D1%80%D0%B0%20%D1%82%D0%B5%D0%BB%D0%B5%D1%84%D0%BE%D0%BD%D0%B0%20%D0%B4%D0%BB%D1%8F%20%D0%B8%D0%B7%D0%BC%D0%B5%D0%BD%D0%B5%D0%BD%D0%B8%D1%8F%20%D0%B4%D0%B0%D0%BD%D0%BD%D1%8B%D1%85)

##### Authorizations:

(_bearer__user_)

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| name | string<br>Имя |
| email | string<br>Почта |
| phone | string<br>Номер телефона |
| confirmation\_code | string<br>Код подтверждения из смс (при смене номера телефона) |

### Responses

**202**
Accepted

### Request samples

- Payload

Content type

application/json

Copy

`{
"name": "Вася",
"email": "test@test.com",
"phone": "79999999999",
"confirmation_code": "1234"}`

### Response samples

- 202

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"meta": {
"message": "Accepted"}}`

## [tag/Polzovateli-onlajn-zapisi/operation/Получение данных пользователя онлайн-записи](https://developers.yclients.com/ru/\#tag/Polzovateli-onlajn-zapisi/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B5%D0%BD%D0%B8%D0%B5%20%D0%B4%D0%B0%D0%BD%D0%BD%D1%8B%D1%85%20%D0%BF%D0%BE%D0%BB%D1%8C%D0%B7%D0%BE%D0%B2%D0%B0%D1%82%D0%B5%D0%BB%D1%8F%20%D0%BE%D0%BD%D0%BB%D0%B0%D0%B9%D0%BD-%D0%B7%D0%B0%D0%BF%D0%B8%D1%81%D0%B8) Получение данных пользователя онлайн-записи

get/booking/user/data

https://api.yclients.com/api/v1/booking/user/data

Получение данных пользователя онлайн-записи.

##### Authorizations:

(_bearer__user_)

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| 0 | string<br>Токен пользователя |
| id | integer<int32><br>Идентификатор пользователя |
| user\_token | string<br>Токен пользователя |
| name | string<br>Имя пользователя |
| phone | string<br>Телефон пользователя |
| login | string<br>Логин пользователя |
| email | string<br>Почта пользователя |
| avatar | string<br>Аватар пользователя |

### Response samples

- 200

Content type

application/json

Copy

`{
"0": "152afb01134237bc844d7e",
"id": 32132133,
"user_token": "152afb01134237bc844d7e",
"name": "Вася",
"phone": "79999999999",
"login": "79999999999",
"email": "vasily@example.com",
"avatar": "https://api.yclients.com/images/avatar.png"}`

# [tag/Kompanii](https://developers.yclients.com/ru/\#tag/Kompanii) Компании

Для работы с компаниями используются следующие методы

### Коллекция компаний

Объект компании имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | Идентификатор компании |
| title | string | Название компании (Обязательное поле для создания компании) |
| logo | string | Адрес изображения логотипа компании |
| short\_descr | string | Категория компании |
| country\_id | number | Идентификатор страны, в которой расположена компания |
| country | string | Название старны компании |
| city\_id | number | Идентификатор города, в котором расположена компания) |
| city | string | Название города компании |
| timezone | string | Timezone компании |
| schedule | string | Расписание работы компании |
| address | string | Адрес, по которому расположена компания |
| phone | string | Номер телефона компании |
| coordinate\_lat | float | Широта, на которой расположена компания |
| coordinate\_lon | float | Долгота |
| app\_ios | string | Ссылка на приложение под ios |
| app\_android | string | Ссылка на приложение под android |
| phone\_confirmation | boolean | Нужно ли подтверждать телефон по смс |
| active\_staff\_count | number | Кол-во сотрудников доступных для бронирования |
| next\_slot | datetime | Дата и время ближайшего свободного сеанса в компании(ISO8601). Поле будет присутствовать только если передан GET параметр forBooking=1 |
| booking\_comment\_required | boolean | Является ли поле с комментарием к записи обязательным для заполнения |
| booking\_email\_required | boolean | Является ли поле Email к записи обязательным для заполнения |
| booking\_comment\_input\_name | string (optional) | Заголовок для поля с вводом комментария к записи (если не задано, то используется значение по умолчанию) |
| booking\_notify\_text | string (optional) | Текст уведомления, которое выводится (если задано) на шаге ввода контактных данных |
| reminds\_sms\_disabled | boolean | True - если у компании выключен сервис SMS напоминаний клиентам. |
| group\_priority | number | Чем больше приоритет, тем выше компания при выводе в списке филиалов сети |
| allow\_change\_record | boolean | Изменение записи |
| allow\_change\_record\_delay\_step | number | Запретить изменять записи за период. (В секундах) |
| allow\_delete\_record | boolean | Удаление записи |
| allow\_delete\_record\_delay\_step | number | Запретить удалять записи за период. (В секундах) |

## [tag/Kompanii/operation/Получить список компаний](https://developers.yclients.com/ru/\#tag/Kompanii/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%BE%D0%BA%20%D0%BA%D0%BE%D0%BC%D0%BF%D0%B0%D0%BD%D0%B8%D0%B9) Получить список компаний

get/companies

https://api.yclients.com/api/v1/companies

Получить список с данными о компаниях

##### Authorizations:

_bearer_

##### query Parameters

|     |     |
| --- | --- |
| id | number<br>Example:id=4564<br>ID компании. Фильтр по идентификатору компании |
| group\_id | number<br>Example:group\_id=83<br>ID сети компаний. Фильтр по идентификатору сети компаний _Default: 83_ |
| my | number<br>Example:my=1<br>Только для авторизованного пользователя. Если нужно компании, на управление которыми пользователь имеет права |
| active | number<br>Example:active=1<br>Если нужно получить только компании с активной лицензией и доступным бронированием |
| moderated | number<br>Example:moderated=1<br>Если нужно получить только прошедшие модерацию компании, чей контент проверен для публикации |
| forBooking | number<br>Example:forBooking=1<br>Показать дату и время ближайшего свободного сеанса в компании (ISO8601) |
| show\_groups | number<br>Example:show\_groups=1<br>Включить в объект компании список сетей в которые входит эта компания |
| city\_id | number<br>Example:city\_id=2<br>Поиск по ID города ( [метод получения городов](https://developers.yclients.com/ru/#cities)) |
| showBookforms | number<br>Example:showBookforms=1<br>Включить в объект компании виджеты онлайн-записи |
| vk\_api\_id | number<br>Example:vk\_api\_id=2<br>Поиск виджеты онлайн-записи по vk\_api\_id. Параметр работает при showBookforms=1 |
| min\_id | number<br>Example:min\_id=1000<br>Минимальный ID компании |
| show\_deleted | number<br>Example:show\_deleted=1<br>Включить в список удалённые компании |
| hide\_record\_type\_single | number<br>Example:hide\_record\_type\_single=1<br>Не показывать салоны с индивидуальной записью |
| hide\_record\_type\_activity | number<br>Example:hide\_record\_type\_activity=1<br>Не показывать салоны с групповой записью |
| hide\_record\_type\_mixed | number<br>Example:hide\_record\_type\_mixed=1<br>Не показывать салоны со смешанной записью |
| business\_group\_id | number<br>Example:business\_group\_id=1<br>Идентификатор группы бизнеса. Фильтр по группе бизнеса |
| business\_type\_id | number<br>Example:business\_type\_id=1<br>Идентификатор сферы бизнеса. Фильтр по сфере бизнеса |
| yandex | number<br>Example:yandex=1<br>Фильтр по синхронизации данных компании с партнерскими площадкам |
| include | Array of strings<br>ItemsEnum:"staff""positions""accounts""storages""expenses"<br>Example:include=staff&include=positions<br>Включить в объект компании дополнительные данные |
| count | number<br>Количество компаний на странице |
| page | number<br>Номер страницы |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Должен быть равен `application/json` |
| Authorization<br>required | string<br>Bearer partner\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешного выполнения (true) |
| data | Array of objects<br>Массив объектов |
| meta | Array of objects<br>Метаданные (пустой массив) |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

### Response samples

- 200
- 401

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": "1050",\
"title": "Ля Визаж",\
"short_descr": "Салон красоты",\
"logo": "https://yclients.com/images/no-master.png",\
"active": "1",\
"phone": "+7 495 509-24-46",\
"country_id": 1,\
"schedule": "",\
"country": "Россия",\
"city_id": 1,\
"city": "Москва",\
"timezone_name": "Europe/Moscow",\
"address": "Талалихина, д. 1, к. 2",\
"coordinate_lat": "55.735662",\
"coordinate_lon": "37.678218",\
"phone_confirmation": true,\
"active_staff_count": 2,\
"next_slot": "2023-03-23T10:10:00+0300",\
"app_ios": "",\
"app_android": "",\
"currency_short_title": "р",\
"group_priority": 900},\
{\
"id": "1051",\
"title": "Ля Визаж 2",\
"short_descr": "Салон красоты",\
"logo": "https://yclients.com/images/no-master.png",\
"active": "1",\
"phone": "+7 495 509-24-46",\
"country_id": 1,\
"country": "Россия",\
"city_id": 1,\
"city": "Москва",\
"timezone_name": "Europe/Moscow",\
"address": "Талалихина, д. 1, к. 2",\
"coordinate_lat": "55.835662",\
"coordinate_lon": "37.778218",\
"phone_confirmation": false,\
"active_staff_count": 3,\
"next_slot": "2023-03-23T10:10:00+0300",\
"app_ios": "",\
"app_android": "",\
"currency_short_title": "р",\
"group_priority": 901}],
"meta": { }}`

## [tag/Kompanii/operation/Создать компанию](https://developers.yclients.com/ru/\#tag/Kompanii/operation/%D0%A1%D0%BE%D0%B7%D0%B4%D0%B0%D1%82%D1%8C%20%D0%BA%D0%BE%D0%BC%D0%BF%D0%B0%D0%BD%D0%B8%D1%8E) Создать компанию

post/companies

https://api.yclients.com/api/v1/companies

Создать новую компанию.

##### Authorizations:

(_bearer__user_)

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Должен быть равен `application/json` |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| title | string<br>Название компании |
| country\_id | number<br>Идентификатор страны, в которой расположена копания ( [метод получения стран](https://developers.yclients.com/ru/#countries)) |
| city\_id | number<br>Идентификатор города, в котором расположена компания ( [метод получения городов](https://developers.yclients.com/ru/#cities)) |
| address | string<br>Адрес компании |
| site | string<br>Сайт компании |
| coordinate\_lat | number<float><br>Широта |
| coordinate\_lot | number<float><br>Долгота |
| business\_type\_id | number<br>Сфера бизнеса |
| short\_descr | string<br>Категория компании |

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешного выполнения (true) |
| data | object<br>Объект данных |
| meta | Array of objects<br>Метаданные (пустой массив) |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

### Request samples

- Payload

Content type

application/json

Copy

`{
"title": "Новая компания",
"country_id": 1,
"city_id": 2,
"address": "Талалихина, д. 1, к. 2",
"site": "new-company.ru",
"coordinate_lat": "55.835662",
"coordinate_lot": "37.778218",
"business_type_id": 1,
"short_descr": "Салон красоты"}`

### Response samples

- 201
- 401
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": "1050",
"title": "Новая компания",
"short_descr": "Салон красоты",
"logo": "https://yclients.com/images/no-master.png",
"active": "1",
"phone": "",
"country_id": 1,
"schedule": "",
"country": "Россия",
"city_id": 2,
"city": "Москва",
"timezone_name": "Europe/Moscow",
"address": "Талалихина, д. 1, к. 2",
"coordinate_lat": "55.735662",
"coordinate_lon": "37.678218",
"phone_confirmation": true,
"active_staff_count": 2,
"app_ios": "",
"app_android": "",
"currency_short_title": "р"},
"meta": { }}`

## [tag/Kompanii/operation/Получить компанию](https://developers.yclients.com/ru/\#tag/Kompanii/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D0%BA%D0%BE%D0%BC%D0%BF%D0%B0%D0%BD%D0%B8%D1%8E) Получить компанию

get/company/{id}/

https://api.yclients.com/api/v1/company/{id}/

Получение данных о компании.

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| id<br>required | number<br>Example:37532<br>Идентификатор компании, информацию о которой нужно получить. |

##### query Parameters

|     |     |
| --- | --- |
| my | number<br>Example:my=1<br>Только для авторизованного пользователя. Если нужны дополнительные данные по компании, на управление которой пользователь имеет права |
| forBooking | number<br>Example:forBooking=1<br>Показать дату и время ближайшего свободного сеанса в компании (ISO8601). |
| show\_groups | number<br>Example:show\_groups=1<br>Включить в объект компании список сетей в которые входит эта компания |
| showBookforms | number<br>Example:showBookforms=1<br>Показать виджеты онлайн-записи компании |
| bookform\_id | number<br>Example:bookform\_id=19203<br>Показать адрес виджета онлайн-записи с указанным идентификатором |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Должен быть равен `application/json` |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешного выполнения (true) |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| errors | object (Сообщение об ошибке запроса) <br>Дополнительная информация об ошибках. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| errors | object (Сообщение об ошибке запроса) <br>Дополнительная информация об ошибках. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

### Response samples

- 200
- 401
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 37532,
"title": "Новая компания",
"country_id": 1,
"country": "Россия",
"city_id": 1,
"city": "Москва",
"timezone_name": "Europe/Moscow",
"address": "Большой Саввинский пер., д. 3",
"zip": 119435,
"coordinate_lat": 55.735662,
"coordinate_lon": 37.678218,
"short_descr": "Салон красоты",
"social": {
"facebook": "",
"vk": "vk.com/newcompany",
"instagram": "",
"telegram": "",
"whatsapp": "",
"viber": ""},
"site": "new-company.ru",
"business_type_id": 1,
"description": "Самая <strong>Новая компания</strong> на рынке",
"phone_confirmation": true,
"active_staff_count": 3,
"next_slot": "2023-03-23T10:10:00+0300",
"group_priority": 900,
"push_notification_phone_confirm": 1,
"main_group_id": 9206,
"main_group": {
"id": 9206,
"title": "Основная сеть компании Новая компания"},
"groups": {
"9206": {
"id": 9206,
"title": "Основная сеть компании Новая компания"},
"9207": {
"id": 9207,
"title": "Другая сеть компании Новая компания"}},
"bookforms": [\
{\
"id": 19203,\
"title": "Форма компании Новая компания",\
"is_default": 0,\
"url": "https://n19203.yclients.com/"}],
"online_sales_form_url": "https://o1.yclients.com",
"access": { }},
"meta": { }}`

## [tag/Kompanii/operation/Изменить компанию](https://developers.yclients.com/ru/\#tag/Kompanii/operation/%D0%98%D0%B7%D0%BC%D0%B5%D0%BD%D0%B8%D1%82%D1%8C%20%D0%BA%D0%BE%D0%BC%D0%BF%D0%B0%D0%BD%D0%B8%D1%8E) Изменить компанию

put/company/{id}/

https://api.yclients.com/api/v1/company/{id}/

Изменение данных о компании.

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| id<br>required | number<br>Example:37532<br>Идентификатор компании |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Должен быть равен `application/json` |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| title | string<br>Название компании |
| country\_id | number<br>Идентификатор страны (приоритетнее параметра country) |
| country | string<br>Страна |
| city\_id | number<br>Идентификатор города (приоритетнее параметра city) |
| city | string<br>Город |
| address | string<br>Адрес компании |
| zip | string<br>Индекс |
| phones | Array of strings<br>Телефоны |
| social | object<br>Социальные сети компании |
| site | string<br>Сайт компании |
| coordinate\_lat | number<float><br>Широта |
| coordinate\_lon | number<float><br>Долгота |
| description | string<html><br>Описание |
| business\_type\_id | number<int32><br>Сфера бизнеса |
| short\_descr | string<br>Категория бизнеса |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| id | number<br>Идентификатор компании |
| title | string<br>Название компании |
| country\_id | number<br>Идентификатор страны, в которой расположена компания |
| country | string<br>Название страны, в которой расположена компания |
| city\_id | number<br>Идентификатор города, в котором расположена компания |
| city | string<br>Название города, в котором расположена компания |
| timezone\_name | string<br>Наименование временной зоны, в которой расположена компания |
| address | string<br>Адрес, по которому расположена компания |
| zip | number<br>Индекс |
| social | object<br>Социальные сети компании |
| site | string<br>Сайт компании |
| coordinate\_lat | number<float><br>Широта |
| coordinate\_lon | number<float><br>Долгота |
| description | string<html><br>Описание |
| business\_type\_id | number<int32><br>Сфера бизнеса |
| short\_descr | string<br>Категория бизнеса |
| phone\_confirmation | boolean<br>Нужно ли подтверждать телефон по смс, при бронировании |
| group\_priority | integer<int32><br>Чем больше приоритет, тем выше компания при выводе в списке филиалов сети |
| push\_notification\_phone\_confirm | boolean<br>Подтверждать номер клиента для отправки push уведомлений |
| access | object<br>Список прав |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| errors | object (Сообщение об ошибке запроса) <br>Дополнительная информация об ошибках. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| errors | object (Сообщение об ошибке запроса) <br>Дополнительная информация об ошибках. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"title": "Новая компания",
"country": "Россия",
"city": "Москва",
"address": "Большой Саввинский пер., д. 4",
"zip": "119435",
"phones": [\
"79876543210",\
"79876543211"],
"social": {
"vk": "vk.com/newcompany"},
"site": "new-company.ru",
"coordinate_lat": 55.735662,
"coordinate_lon": 37.678218,
"description": "Самая <strong>Новая компания</strong> на рынке",
"business_type_id": 1,
"short_descr": "Салон красоты"}`

### Response samples

- 200
- 401
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"id": 37532,
"title": "Новая компания",
"country_id": 1,
"country": "Россия",
"city_id": 2,
"city": "Москва",
"timezone_name": "Europe/Moscow",
"address": "Большой Саввинский пер., д. 3",
"zip": 119435,
"coordinate_lat": 55.735662,
"coordinate_lon": 37.678218,
"short_descr": "Салон красоты",
"social": {
"facebook": "",
"vk": "vk.com/newcompany",
"instagram": "",
"telegram": "",
"whatsapp": "",
"viber": ""},
"site": "new-company.ru",
"business_type_id": 1,
"description": "Самая <strong>Новая компания</strong> на рынке",
"phone_confirmation": true,
"group_priority": 900,
"push_notification_phone_confirm": 1,
"access": { }}`

## [tag/Kompanii/operation/Удалить компанию](https://developers.yclients.com/ru/\#tag/Kompanii/operation/%D0%A3%D0%B4%D0%B0%D0%BB%D0%B8%D1%82%D1%8C%20%D0%BA%D0%BE%D0%BC%D0%BF%D0%B0%D0%BD%D0%B8%D1%8E) Удалить компанию

delete/company/{id}/

https://api.yclients.com/api/v1/company/{id}/

Удаление компании.

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| id<br>required | number<br>Example:37532<br>Идентификатор компании |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Должен быть равен `application/json` |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**202**
Accepted

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| errors | object (Сообщение об ошибке запроса) <br>Дополнительная информация об ошибках. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| errors | object (Сообщение об ошибке запроса) <br>Дополнительная информация об ошибках. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

### Response samples

- 401
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"errors": {
"code": 401,
"message": "Необходима авторизация"},
"meta": {
"message": "Необходима авторизация"}}`

# [tag/Kategoriya-uslug](https://developers.yclients.com/ru/\#tag/Kategoriya-uslug) Категория услуг

Для работы с категориями услуг используются следующие методы

Объект категории услуг имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | Идентификатор категории |
| title | string | Название категории |
| api\_id | Integer | Внешний идентификатор категории |
| weight | number | Вес категории (используется для сортировки категорий при отображении) |
| staff | array | Список ID сотрудников, оказывающих услугу |

#### Фильтрация категорий услуг

- staff\_id: ID сотрудника. Если нужны услуги, которые оказывает конкретный мастер

## [tag/Kategoriya-uslug/operation/Создать категорию услугу](https://developers.yclients.com/ru/\#tag/Kategoriya-uslug/operation/%D0%A1%D0%BE%D0%B7%D0%B4%D0%B0%D1%82%D1%8C%20%D0%BA%D0%B0%D1%82%D0%B5%D0%B3%D0%BE%D1%80%D0%B8%D1%8E%20%D1%83%D1%81%D0%BB%D1%83%D0%B3%D1%83) Создать категорию услугу

post/service\_categories/{company\_id}

https://api.yclients.com/api/v1/service\_categories/{company\_id}

##### Authorizations:

(_bearer__user_)

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| title | string<br>Название категории услуг |
| api\_id | string<br>Внешний идентификатор категории |
| weight | number<br>Вес категории (используется для сортировки категорий при отображении) |
| staff | Array of numbers<br>Список ID сотрудников, оказывающих услуги из категории |

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"title": "Стрижка очень женская",
"api_id": "adw322",
"weight": 111,
"staff": [\
5006,\
8901]}`

### Response samples

- 201

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 3,
"title": "Стрижка очень женская",
"api_id": "adw322",
"weight": 111,
"staff": [\
5006,\
8901]},
"meta": [ ]}`

## [tag/Kategoriya-uslug/operation/Получить категорию услуг](https://developers.yclients.com/ru/\#tag/Kategoriya-uslug/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D0%BA%D0%B0%D1%82%D0%B5%D0%B3%D0%BE%D1%80%D0%B8%D1%8E%20%D1%83%D1%81%D0%BB%D1%83%D0%B3) Получить категорию услуг

get/service\_category/{company\_id}/{id}

https://api.yclients.com/api/v1/service\_category/{company\_id}/{id}

##### Authorizations:

_bearer_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| id<br>required | number<br>ID категории услуг |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов |
| meta | object<br>Метаданные (количество категорий) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 3,
"salon_service_id": 15,
"title": "Стрижки женские",
"weight": 12,
"staff": [\
5006,\
8901]},
"meta": [ ]}`

## [tag/Kategoriya-uslug/operation/Изменить категорию услуг](https://developers.yclients.com/ru/\#tag/Kategoriya-uslug/operation/%D0%98%D0%B7%D0%BC%D0%B5%D0%BD%D0%B8%D1%82%D1%8C%20%D0%BA%D0%B0%D1%82%D0%B5%D0%B3%D0%BE%D1%80%D0%B8%D1%8E%20%D1%83%D1%81%D0%BB%D1%83%D0%B3) Изменить категорию услуг

put/service\_category/{company\_id}/{id}

https://api.yclients.com/api/v1/service\_category/{company\_id}/{id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| id<br>required | number<br>ID категории услуги |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| title | string<br>Название категории услуг |
| api\_id | string<br>Внешний идентификатор категории |
| weight | number<br>Вес категории (используется для сортировки категорий при отображении) |
| staff | Array of numbers<br>Список ID сотрудников, оказывающих услуги из категории |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов |
| meta | object<br>Метаданные (количество категорий) |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"title": "Стрижка очень женская",
"api_id": "adw322",
"weight": 111,
"staff": [\
5006,\
8901]}`

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 3,
"salon_service_id": 15,
"title": "Стрижки женские",
"weight": 15,
"staff": [\
5006,\
8901]},
"meta": [ ]}`

## [tag/Kategoriya-uslug/operation/Удалить категорию услуг](https://developers.yclients.com/ru/\#tag/Kategoriya-uslug/operation/%D0%A3%D0%B4%D0%B0%D0%BB%D0%B8%D1%82%D1%8C%20%D0%BA%D0%B0%D1%82%D0%B5%D0%B3%D0%BE%D1%80%D0%B8%D1%8E%20%D1%83%D1%81%D0%BB%D1%83%D0%B3) Удалить категорию услуг

delete/service\_category/{company\_id}/{id}

https://api.yclients.com/api/v1/service\_category/{company\_id}/{id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| id<br>required | number<br>ID категории услуги |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Conetnt-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**204**
No Content

## [tag/Kategoriya-uslug/paths/~1chain~1{chain_id}~1service_categories/get](https://developers.yclients.com/ru/\#tag/Kategoriya-uslug/paths/~1chain~1{chain_id}~1service_categories/get) Получить список категорий услуг сети

get/chain/{chain\_id}/service\_categories

https://api.yclients.com/api/v1/chain/{chain\_id}/service\_categories

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| chain\_id<br>required | integer<br>Идентификатор сети |

##### query Parameters

|     |     |
| --- | --- |
| include | string<br>Value:"services"<br>Включить в ответ дополительные ресурсы |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

Array

|     |     |
| --- | --- |
| id | integer<int32><br>Идентификатор категории услуг |
| title | string<br>Название категории услуг |
| services | Array of objects (Root Type for ServiceTitle) <br>Услуги в категории (по запросу) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`[\
{\
"id": 41,\
"title": "Категория услуг",\
"services": [\
{\
"id": 52,\
"title": "Услуга 1"},\
{\
"id": 45,\
"title": "Услуга 2"}]}]`

## [tag/Kategoriya-uslug/operation/Получить список категорий услуг](https://developers.yclients.com/ru/\#tag/Kategoriya-uslug/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%BE%D0%BA%20%D0%BA%D0%B0%D1%82%D0%B5%D0%B3%D0%BE%D1%80%D0%B8%D0%B9%20%D1%83%D1%81%D0%BB%D1%83%D0%B3) Получить список категорий услуг

get/company/{company\_id}/service\_categories/{id}

https://api.yclients.com/api/v1/company/{company\_id}/service\_categories/{id}

- Параметры
  - company\_id (required, number) - ID компании
  - id (optional, number) - ID категории услуг (для работы с конкретной категорией)
  - staff\_id (optional, number) - ID сотрудника (для получения категорий, привязанных к сотруднику)

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| id<br>required | number<br>ID категории услуг |

##### query Parameters

|     |     |
| --- | --- |
| staff\_id | number<br>ID сотрудника (для получения категорий, привязанных к сотруднику) |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов |
| meta | object<br>Метаданные (количество категорий) |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | string<br>имеет значение null |
| meta | object<br>Метаданные (сообщение об ошибке) |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | string<br>имеет значение null |
| meta | object<br>Метаданные (содержит возможные сообщения об ошибке) |

### Response samples

- 200
- 403
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 345,\
"salon_service_id": 353,\
"title": "Стрижки мужские",\
"api_id": "adw322",\
"weight": 10,\
"staff": [\
5006,\
8901,\
26514,\
26516,\
26519,\
26520]},\
{\
"id": 3456,\
"salon_service_id": 3252,\
"title": "Стрижки женские",\
"api_id": "adw323",\
"weight": 9,\
"staff": [\
5006,\
8901]}],
"meta": {
"total_count": 2}}`

## [tag/Kategoriya-uslug/operation/Устаревшее. Получить список категорий услуг](https://developers.yclients.com/ru/\#tag/Kategoriya-uslug/operation/%D0%A3%D1%81%D1%82%D0%B0%D1%80%D0%B5%D0%B2%D1%88%D0%B5%D0%B5.%20%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%BE%D0%BA%20%D0%BA%D0%B0%D1%82%D0%B5%D0%B3%D0%BE%D1%80%D0%B8%D0%B9%20%D1%83%D1%81%D0%BB%D1%83%D0%B3) Устаревшее. Получить список категорий услуг Deprecated

get/service\_categories/{company\_id}/{id}

https://api.yclients.com/api/v1/service\_categories/{company\_id}/{id}

Получить список категорий услуг

##### Authorizations:

_bearer_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Идентификатор компании |
| id<br>required | number<br>Идентификатор категории услуги |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов |
| meta | object<br>Метаданные (количество категорий) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 345,\
"title": "Стрижки мужские",\
"api_id": "adw322",\
"weight": 10,\
"staff": [\
5006,\
8901,\
26514,\
26516,\
26519,\
26520]},\
{\
"id": 3456,\
"title": "Стрижки женские",\
"api_id": "adw323",\
"weight": 9,\
"staff": [\
5006,\
8901]}],
"meta": [ ]}`

# [tag/Uslugi](https://developers.yclients.com/ru/\#tag/Uslugi) Услуги

Для работы с услугами используются следующие методы

Объект услуги имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | Идентификатор услуги |
| category\_id | number | Идентификатор категории, в которой состоит услуга |
| title | string | Название категории |
| price\_min | number | Минимальная цена на услугу |
| price\_max | number | Максимальная цена на услугу |
| duration | number | Длительность услуги, по умолчанию равна 3600 секундам |
| service\_type | number | 1 - доступна для онлайн записи, 0 - не доступна |
| comment | string | комментарий у услуге |
| api\_service\_id | Integer | Внешний идентификатор услуги |
| weight | number | Вес категории (используется для сортировки категорий при отображении) |
| staff | array | Список сотрудников, оказывающих услугу и длительность сеанса |
| image\_group | object | Группа изображений услуги |

Массив со списком сотрудников, оказывающих услугу состоит из объектов со следующими полями

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | Идентификатор сотрудника |
| seance\_length | number | Длительность оказания услуги мастером. (В секундах) |

#### Фильтрация услуг

- staff\_id: ID сотрудника. Если нужны услуги, которые оказывает конкретный мастер

- category\_id: ID категории. Если нужны услуги, из конкретной категории


## [tag/Uslugi/operation/Создать услугу](https://developers.yclients.com/ru/\#tag/Uslugi/operation/%D0%A1%D0%BE%D0%B7%D0%B4%D0%B0%D1%82%D1%8C%20%D1%83%D1%81%D0%BB%D1%83%D0%B3%D1%83) Создать услугу

post/services/{company\_id}

https://api.yclients.com/api/v1/services/{company\_id}

Метод, позволяющий создать услугу

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorizarion<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| title | string<br>Название услуги |
| category\_id | number<br>ID категории услуг |
| price\_min | number<float><br>Минимальная стоимость услуги |
| price\_max | number<float><br>Максимальная стоимость услуги |
| duration | number<br>Длительность услуги, по умолчанию равна 3600 секундам |
| technical\_break\_duration | number or null\[ 0 .. 3600 \]<br>Длительность технического перерыва<br>- Если не передан. Значение по умолчанию null <br>- Значение null, соответствует общей настройке филиала, и задается в разделе _Настройки → Журнал записи → Технические перерывы_<br>- Параметр принимает только значения, кратные 300 (5-минутные интервалы) <br>- Максимальное допустимое значение 3600 (1 час) |
| discount | number<float><br>Скидка при оказании услуги |
| comment | string<br>Комментарий к услуге |
| weight | number<br>Вес услуги (используется для сортировки услуг при отображении) |
| service\_type | number<br>Доступна ли для онлайн записи услуга. 1 - доступна, 0 не доступна. |
| api\_service\_id | string<br>Внешний идентификатор услуги |
| staff | Array of objects<br>Сотрудники, оказываюшие услугу и длительность оказания услуги каждым из них |

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"title": "Мужская стрижка",
"category_id": 83167,
"price_min": 1300,
"price_max": 1300,
"duration": 3600,
"discount": 0,
"comment": "",
"weight": 6,
"active": 1,
"api_id": "00000000042",
"staff": [\
{\
"id": 5905,\
"seance_length": 2700},\
{\
"id": 5907,\
"seance_length": 3600},\
{\
"id": 8973,\
"seance_length": 3600},\
{\
"id": 13616,\
"seance_length": 3600},\
{\
"id": 16681,\
"seance_length": 3600},\
{\
"id": 1796,\
"seance_length": 3600},\
{\
"id": 34006,\
"seance_length": 3600}]}`

### Response samples

- 201

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 83169,
"title": "Мужская стрижка",
"category_id": 83167,
"price_min": 1300,
"price_max": 1300,
"discount": 0,
"duration": 3600,
"comment": "",
"weight": 6,
"active": 1,
"api_id": "00000000042",
"staff": [\
{\
"id": 5905,\
"seance_length": 2700},\
{\
"id": 5907,\
"seance_length": 3600},\
{\
"id": 8973,\
"seance_length": 3600},\
{\
"id": 13616,\
"seance_length": 3600},\
{\
"id": 16681,\
"seance_length": 3600},\
{\
"id": 1796,\
"seance_length": 3600},\
{\
"id": 34006,\
"seance_length": 3600}]},
"meta": [ ]}`

## [tag/Uslugi/operation/Получить список услуг / конкретную услугу](https://developers.yclients.com/ru/\#tag/Uslugi/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%BE%D0%BA%20%D1%83%D1%81%D0%BB%D1%83%D0%B3%20/%20%D0%BA%D0%BE%D0%BD%D0%BA%D1%80%D0%B5%D1%82%D0%BD%D1%83%D1%8E%20%D1%83%D1%81%D0%BB%D1%83%D0%B3%D1%83) Получить список услуг / конкретную услугу

get/company/{company\_id}/services/{service\_id}

https://api.yclients.com/api/v1/company/{company\_id}/services/{service\_id}

- Параметр
  - company\_id (required, number, `1`) \- ID компании
  - service\_id (optional, number, `1`) \- ID услуги

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| service\_id<br>required | number<br>ID услуги, если нужно работать с конкретной услугой. |

##### query Parameters

|     |     |
| --- | --- |
| staff\_id | number<br>ID сотрудника, если нужно отфильтровать по сотруднику |
| category\_id | number<br>ID категории, если нужно отфильтровать по категории |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | object<br>Метаданные (содержит количество найденных услуг) |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | string<br>имеет значение null |
| meta | object<br>Метаданные (сообщение об ошибке) |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | string<br>имеет значение null |
| meta | object<br>Метаданные (содержит возможные сообщения об ошибке) |

### Response samples

- 200
- 403
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": "79067",\
"title": "Бритье головы",\
"category_id": "4",\
"price_min": "1000.00",\
"price_max": "1000.00",\
"discount": "0",\
"comment": "",\
"weight": "2",\
"active": "1",\
"api_id": "",\
"staff": [ ]},\
{\
"id": "83169",\
"title": "Мужская стрижка",\
"category_id": "83167",\
"price_min": "1300.00",\
"price_max": "1300.00",\
"discount": "0",\
"comment": "",\
"weight": "6",\
"active": "1",\
"api_id": "00000000042",\
"staff": [\
{\
"id": "5905",\
"seance_length": "2700"},\
{\
"id": "5907",\
"seance_length": "3600"},\
{\
"id": "8973",\
"seance_length": "3600"},\
{\
"id": "13616",\
"seance_length": "3600"},\
{\
"id": "16681",\
"seance_length": "3600"},\
{\
"id": "17969",\
"seance_length": "3600"},\
{\
"id": "34006",\
"seance_length": "3600"}],\
"image_group": {\
"id": 72234,\
"entity": "settings_service",\
"entity_id": 389927,\
"images": {\
"basic": {\
"id": "186791",\
"path": "https://yclients.com/path/to/image/tagret-image.jpeg",\
"width": "372",\
"height": "280",\
"type": "jpeg",\
"image_group_id": 72234,\
"version": "basic"}}}}],
"meta": {
"total_count": 2}}`

## [tag/Uslugi/operation/Изменить услугу](https://developers.yclients.com/ru/\#tag/Uslugi/operation/%D0%98%D0%B7%D0%BC%D0%B5%D0%BD%D0%B8%D1%82%D1%8C%20%D1%83%D1%81%D0%BB%D1%83%D0%B3%D1%83) Изменить услугу

patch/company/{company\_id}/services/{service\_id}

https://api.yclients.com/api/v1/company/{company\_id}/services/{service\_id}

Метод, позволяющий изменить услугу

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| service\_id<br>required | number<br>ID услуги |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| title<br>required | string<br>Название услуги |
| booking\_title<br>required | string<br>Название услуги для онлайн-записи |
| category\_id<br>required | number<br>ID категории услуг |
| price\_min<br>required | number<float><br>Минимальная стоимость услуги |
| price\_max<br>required | number<float><br>Максимальная стоимость услуги |
| duration<br>required | number<br>Длительность услуги, по умолчанию равна 3600 секундам |
| technical\_break\_duration | number or null\[ 0 .. 3600 \]<br>Длительность технического перерыва<br>- Если не передан. Значение по умолчанию null <br>- Значение null, соответствует общей настройке филиала, и задается в разделе _Настройки → Журнал записи → Технические перерывы_<br>- Параметр принимает только значения, кратные 300 (5-минутные интервалы)<br>- Максимальное допустимое значение 3600 (1 час) |
| discount | number<float><br>Скидка при оказании услуги |
| comment | string<br>Комментарий к услуге |
| is\_multi<br>required | boolean<br>false - индивидуальная услуга, true - групповая услуга |
| tax\_variant<br>required | number<br>ID системы налогообложения |
| vat\_id<br>required | number<br>ID НДС |
| is\_need\_limit\_date<br>required | boolean<br>Ограничение по датам для онлайн-записи |
| date\_from | string<br>Дата с которой услуга будет доступна в формате yyyy-mm-dd |
| date\_to | string<br>Дата до которой услуга будет доступна в формате yyyy-mm-dd |
| dates | array of strings<br>Список дат в которые будет доступна онлайн запись (если массив не передан, все даты за указанный период будут доступны) |
| seance\_search\_start<br>required | number<br>Начало периода в какое время доступна запись, указывается в секундах |
| seance\_search\_finish<br>required | number<br>Конец периода в какое время доступна запись, указывается в секундах |
| step<br>required | number<br>Шаг вывода сеансов, указывается в секундах |
| seance\_search\_step<br>required | number<br>Шаг поиска сеансов, указывается в секундах |
| weight | number<br>Вес услуги (используется для сортировки услуг при отображении) |
| service\_type | number<br>Доступна ли для онлайн записи услуга. 1 - доступна, 0 не доступна. |
| api\_service\_id | integer<br>Внешний идентификатор услуги |
| online\_invoicing\_status | integer<br>Онлайн-предоплата включена (0-выключена, 2-включена) |
| price\_prepaid\_percent | integer<br>Размер предоплаты в процентах (от минимальной стоимости услуги) |
| price\_prepaid\_amount | integer<br>Сумма предоплаты |
| abonement\_restriction\_value | integer<br>Запрет записи без абонемента (Только если online\_invoicing\_status=0) |
| is\_abonement\_autopayment\_enabled | integer<br>Автосписание с абонемента |
| autopayment\_before\_visit\_time | integer<br>За какое время до визита производится автосписание |
| staff | Array of objects<br>Сотрудники, оказываюшие услугу и длительность оказания услуги каждым из них |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"title": "Мужская стрижка",
"booking_title": "Мужская стрижка",
"category_id": 83167,
"price_min": 1300,
"price_max": 1300,
"duration": 3600,
"discount": 0,
"tax_variant": 1,
"vat_id": 3,
"is_multi": false,
"is_need_limit_date": true,
"api_service_id": 1234,
"date_from": "2022-09-19",
"date_to": "2022-09-30",
"seance_search_start": 36000,
"seance_search_finish": 84600,
"step": 300,
"seance_search_step": 900,
"comment": "",
"weight": 6,
"service_type": 1,
"staff": [\
{\
"id": 5905,\
"seance_length": 2700},\
{\
"id": 5907,\
"seance_length": 3600},\
{\
"id": 8973,\
"seance_length": 3600},\
{\
"id": 13616,\
"seance_length": 3600},\
{\
"id": 16681,\
"seance_length": 3600},\
{\
"id": 1796,\
"seance_length": 3600},\
{\
"id": 34006,\
"seance_length": 3600}]}`

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"booking_title": "Мужская стрижка",
"tax_variant": 0,
"vat_id": 2,
"print_title": "Мужская стрижка",
"service_type": 1,
"api_service_id": 1234,
"repeat_visit_days_step": "null",
"seance_search_start": 1800,
"seance_search_finish": 84600,
"seance_search_step": 900,
"step": 300,
"is_need_limit_date": "true",
"date_from": "2022-09-19",
"date_to": "2022-09-30",
"schedule_template_type": 2,
"online_invoicing_status": 0,
"is_abonement_autopayment_enabled": 0,
"autopayment_before_visit_time": 0,
"abonement_restriction_value": 0,
"is_chain": "false",
"is_price_managed_only_in_chain": "false",
"is_comment_managed_only_in_chain": "false",
"price_prepaid_amount": 0,
"price_prepaid_percent": 100,
"id": 10832934,
"salon_service_id": 12192004,
"title": "Мужская стрижка",
"category_id": 10832928,
"price_min": 250,
"price_max": 1200,
"discount": 0,
"comment": "",
"weight": 0,
"active": 1,
"api_id": "1234",
"prepaid": "forbidden",
"is_multi": "false",
"capacity": 0,
"image_group": [ ],
"staff": [\
{\
"id": 5905,\
"seance_length": 2700,\
"technological_card_id": 0},\
{\
"id": 5907,\
"seance_length": 3600,\
"technological_card_id": 0}],
"dates": [\
"2022-09-19",\
"2022-09-20",\
"2022-09-21",\
"2022-09-22",\
"2022-09-23",\
"2022-09-24",\
"2022-09-25",\
"2022-09-26",\
"2022-09-27",\
"2022-09-28",\
"2022-09-29",\
"2022-09-30"],
"duration": 3600,
"resources": [ ],
"is_online": true},
"meta": [ ]}`

## [tag/Uslugi/operation/Устаревшее. Получить список услуг / конкретную услугу](https://developers.yclients.com/ru/\#tag/Uslugi/operation/%D0%A3%D1%81%D1%82%D0%B0%D1%80%D0%B5%D0%B2%D1%88%D0%B5%D0%B5.%20%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%BE%D0%BA%20%D1%83%D1%81%D0%BB%D1%83%D0%B3%20/%20%D0%BA%D0%BE%D0%BD%D0%BA%D1%80%D0%B5%D1%82%D0%BD%D1%83%D1%8E%20%D1%83%D1%81%D0%BB%D1%83%D0%B3%D1%83) Устаревшее. Получить список услуг / конкретную услугу Deprecated

get/services/{company\_id}/{service\_id}

https://api.yclients.com/api/v1/services/{company\_id}/{service\_id}

##### Authorizations:

_bearer_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| service\_id<br>required | number<br>ID услуги, если нужно работать с конкретной услугой. |

##### query Parameters

|     |     |
| --- | --- |
| staff\_id | number<br>ID сотрудника, если нужно отфильтровать по сотруднику |
| category\_id | number<br>ID категории, если нужно отфильтровать по категории |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | object<br>Метаданные (содержит количество найденных услуг) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": "79067",\
"title": "Бритье головы",\
"category_id": "4",\
"price_min": "1000.00",\
"price_max": "1000.00",\
"discount": "0",\
"comment": "",\
"weight": "2",\
"active": "1",\
"api_id": "",\
"staff": [ ]},\
{\
"id": "83169",\
"title": "Мужская стрижка",\
"category_id": "83167",\
"price_min": "1300.00",\
"price_max": "1300.00",\
"discount": "0",\
"comment": "",\
"weight": "6",\
"active": "1",\
"api_id": "00000000042",\
"staff": [\
{\
"id": "5905",\
"seance_length": "2700"},\
{\
"id": "5907",\
"seance_length": "3600"},\
{\
"id": "8973",\
"seance_length": "3600"},\
{\
"id": "13616",\
"seance_length": "3600"},\
{\
"id": "16681",\
"seance_length": "3600"},\
{\
"id": "17969",\
"seance_length": "3600"},\
{\
"id": "34006",\
"seance_length": "3600"}],\
"image_group": {\
"id": 72234,\
"entity": "settings_service",\
"entity_id": 389927,\
"images": {\
"basic": {\
"id": "186791",\
"path": "https://yclients.com/path/to/image/tagret-image.jpeg",\
"width": "372",\
"height": "280",\
"type": "jpeg",\
"image_group_id": 72234,\
"version": "basic"}}}}],
"meta": [ ]}`

## [tag/Uslugi/operation/Устаревшее. Изменить услугу](https://developers.yclients.com/ru/\#tag/Uslugi/operation/%D0%A3%D1%81%D1%82%D0%B0%D1%80%D0%B5%D0%B2%D1%88%D0%B5%D0%B5.%20%D0%98%D0%B7%D0%BC%D0%B5%D0%BD%D0%B8%D1%82%D1%8C%20%D1%83%D1%81%D0%BB%D1%83%D0%B3%D1%83) Устаревшее. Изменить услугу Deprecated

put/services/{company\_id}/{service\_id}

https://api.yclients.com/api/v1/services/{company\_id}/{service\_id}

Устаревшее. Метод, позволяющий изменить услугу

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| service\_id<br>required | number<br>ID услуги |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| title | string<br>Название услуги |
| category\_id | number<br>ID категории услуг |
| price\_min | number<float><br>Минимальная стоимость услуги |
| price\_max | number<float><br>Максимальная стоимость услуги |
| duration | number<br>Длительность услуги, по умолчанию равна 3600 секундам |
| discount | number<float><br>Скидка при оказании услуги |
| comment | string<br>Комментарий к услуге |
| weight | number<br>Вес услуги (используется для сортировки услуг при отображении) |
| service\_type | number<br>Доступна ли для онлайн записи услуга. 1 - доступна, 0 не доступна. |
| api\_service\_id | string<br>Внешний идентификатор услуги |
| staff | Array of objects<br>Сотрудники, оказываюшие услугу и длительность оказания услуги каждым из них |

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"title": "Мужская стрижка",
"category_id": 83167,
"price_min": 1300,
"price_max": 1300,
"duration": 3600,
"discount": 0,
"comment": "",
"weight": 6,
"active": 1,
"api_id": "00000000042",
"staff": [\
{\
"id": 5905,\
"seance_length": 2700},\
{\
"id": 5907,\
"seance_length": 3600},\
{\
"id": 8973,\
"seance_length": 3600},\
{\
"id": 13616,\
"seance_length": 3600},\
{\
"id": 16681,\
"seance_length": 3600},\
{\
"id": 1796,\
"seance_length": 3600},\
{\
"id": 34006,\
"seance_length": 3600}]}`

### Response samples

- 201

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 83169,
"title": "Мужская стрижка",
"category_id": 83167,
"price_min": 1300,
"price_max": 1300,
"duration": 3600,
"discount": 0,
"comment": "",
"weight": 6,
"active": 1,
"api_id": "00000000042",
"staff": [\
{\
"id": 5905,\
"seance_length": 2700},\
{\
"id": 5907,\
"seance_length": 3600},\
{\
"id": 8973,\
"seance_length": 3600},\
{\
"id": 13616,\
"seance_length": 3600},\
{\
"id": 16681,\
"seance_length": 3600},\
{\
"id": 1796,\
"seance_length": 3600},\
{\
"id": 34006,\
"seance_length": 3600}]},
"meta": [ ]}`

## [tag/Uslugi/operation/Удалить услугу](https://developers.yclients.com/ru/\#tag/Uslugi/operation/%D0%A3%D0%B4%D0%B0%D0%BB%D0%B8%D1%82%D1%8C%20%D1%83%D1%81%D0%BB%D1%83%D0%B3%D1%83) Удалить услугу

delete/services/{company\_id}/{service\_id}

https://api.yclients.com/api/v1/services/{company\_id}/{service\_id}

Метод, позволяющий удалить услугу

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| service\_id<br>required | number<br>ID услуги |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**204**
No Content

## [tag/Uslugi/operation/Изменить длительность оказания услуги сотрудниками, технические карты, названия на других языках](https://developers.yclients.com/ru/\#tag/Uslugi/operation/%D0%98%D0%B7%D0%BC%D0%B5%D0%BD%D0%B8%D1%82%D1%8C%20%D0%B4%D0%BB%D0%B8%D1%82%D0%B5%D0%BB%D1%8C%D0%BD%D0%BE%D1%81%D1%82%D1%8C%20%D0%BE%D0%BA%D0%B0%D0%B7%D0%B0%D0%BD%D0%B8%D1%8F%20%D1%83%D1%81%D0%BB%D1%83%D0%B3%D0%B8%20%D1%81%D0%BE%D1%82%D1%80%D1%83%D0%B4%D0%BD%D0%B8%D0%BA%D0%B0%D0%BC%D0%B8,%20%D1%82%D0%B5%D1%85%D0%BD%D0%B8%D1%87%D0%B5%D1%81%D0%BA%D0%B8%D0%B5%20%D0%BA%D0%B0%D1%80%D1%82%D1%8B,%20%D0%BD%D0%B0%D0%B7%D0%B2%D0%B0%D0%BD%D0%B8%D1%8F%20%D0%BD%D0%B0%20%D0%B4%D1%80%D1%83%D0%B3%D0%B8%D1%85%20%D1%8F%D0%B7%D1%8B%D0%BA%D0%B0%D1%85) Изменить длительность оказания услуги сотрудниками, технические карты, названия на других языках

post/company/{company\_id}/services/links

https://api.yclients.com/api/v1/company/{company\_id}/services/links

Метод, позволяющий изменить длительность оказания услуги сотрудниками, технические карты, названия на других языках

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| service\_id<br>required | number<br>ID услуги |
| master\_settings<br>required | Array of objects<br>Список сотрудников, оказывающих услугу c длительностью сеанса и технологическими картами |
| resource\_ids<br>required | Array of numbers<br>Список ресурсов необходимых для оказания услуги |
| translations<br>required | Array of objects<br>Список переводов для каждого языка |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"service_id": 10832939,
"master_settings": [\
{\
"master_id": 2033728,\
"technological_card_id": 291341,\
"hours": 0,\
"minutes": 45,\
"price": {\
"min": 999.99,\
"max": null}},\
{\
"master_id": 1987799,\
"technological_card_id": 291341,\
"hours": 1,\
"minutes": 15,\
"price": null}],
"resource_ids": [\
62173],
"translations": [\
{\
"language_id": 1,\
"translation": ""},\
{\
"language_id": 2,\
"translation": "Massage"}]}`

## [tag/Uslugi/operation/api.location.services.staff.create](https://developers.yclients.com/ru/\#tag/Uslugi/operation/api.location.services.staff.create) Привязка сотрудника, оказывающего услугу

post/company/{company\_id}/services/{service\_id}/staff

https://api.yclients.com/api/v1/company/{company\_id}/services/{service\_id}/staff

Создает привязку сотрудника к услуге с указанием длительности и технологической карты.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |
| service\_id<br>required | number<br>Example:123<br>Идентификатор услуги. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| master\_id<br>required | number<br>Идентификатор сотрудника, оказывающего услугу. |
| seance\_length<br>required | number<br>Длительность оказания услуги указанным сотрудником в секундах,<br>минимально 300 секунд (5 минут), максимально 86100 секунд (23 часа 55 минут). |
| technological\_card\_id<br>required | number or null<br>Идентификатор технологической карты, используемой при оказании услуги указанным сотрудником. |

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object (Объект модели "Сотрудник, оказывающий услугу") |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Request samples

- Payload

Content type

application/json

Copy

`{
"master_id": 123,
"seance_length": 3600,
"technological_card_id": 123}`

### Response samples

- 201
- 401
- 403
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"service_id": 123,
"master_id": 123,
"length": 3600,
"technological_card_id": 123},
"meta": { }}`

## [tag/Uslugi/operation/api.location.services.staff.update](https://developers.yclients.com/ru/\#tag/Uslugi/operation/api.location.services.staff.update) Изменение настроек оказания услуги сотрудником

put/company/{company\_id}/services/{service\_id}/staff/{master\_id}

https://api.yclients.com/api/v1/company/{company\_id}/services/{service\_id}/staff/{master\_id}

Обновляет данные привязки сотрудника к услуге с указанием длительности и технологической карты.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |
| service\_id<br>required | number<br>Example:123<br>Идентификатор услуги. |
| master\_id<br>required | number<br>Example:123<br>Идентификатор сотрудника. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| seance\_length<br>required | number<br>Длительность оказания услуги указанным сотрудником в секундах,<br>минимально 300 секунд (5 минут), максимально 86100 секунд (23 часа 55 минут). |
| technological\_card\_id<br>required | number or null<br>Идентификатор технологической карты, используемой при оказании услуги указанным сотрудником. |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object (Объект модели "Сотрудник, оказывающий услугу") |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Request samples

- Payload

Content type

application/json

Copy

`{
"seance_length": 3600,
"technological_card_id": 123}`

### Response samples

- 200
- 401
- 403
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"service_id": 123,
"master_id": 123,
"length": 3600,
"technological_card_id": 123},
"meta": { }}`

## [tag/Uslugi/operation/api.location.services.staff.delete](https://developers.yclients.com/ru/\#tag/Uslugi/operation/api.location.services.staff.delete) Отвязка сотрудника, оказывающего услугу

delete/company/{company\_id}/services/{service\_id}/staff/{master\_id}

https://api.yclients.com/api/v1/company/{company\_id}/services/{service\_id}/staff/{master\_id}

Удаляет привязку сотрудника к услуге.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |
| service\_id<br>required | number<br>Example:123<br>Идентификатор услуги. |
| master\_id<br>required | number<br>Example:123<br>Идентификатор сотрудника. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

### Responses

**204**
No Content

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

### Response samples

- 204
- 401
- 403
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": null,
"meta": { }}`

# [tag/Polzovateli](https://developers.yclients.com/ru/\#tag/Polzovateli) Пользователи

Управление пользователями, в частности работа с ролями и правами.

## [tag/Polzovateli/operation/api.location.users.roles.list](https://developers.yclients.com/ru/\#tag/Polzovateli/operation/api.location.users.roles.list) Получение списка ролей пользователей

get/company/{company\_id}/users/roles

https://api.yclients.com/api/v1/company/{company\_id}/users/roles

Возвращает список ролей пользователей вместе с правами для каждой роли.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |

##### query Parameters

|     |     |
| --- | --- |
| include | Array of strings<br>ItemsValue:"user\_permissions"<br>Набор сущностей, которые должны быть включены в ответ. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | Array of objects (Объект модели "Роль пользователя") |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

### Response samples

- 200
- 401
- 403
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"slug": "worker",\
"title": "Сотрудник",\
"description": "Оказывает услуги",\
"weight": 1,\
"user_permissions": [\
{\
"slug": "timetable_access",\
"title": "Журнал записей",\
"hint": "",\
"is_recommended": true,\
"is_editable": true,\
"default_value": true,\
"entity_name": null,\
"children": [\
{\
"slug": "timetable_position_id",\
"title": "Просматривать расписание и записи должностей",\
"hint": "",\
"is_recommended": true,\
"is_editable": true,\
"default_value": null,\
"entity_name": "position",\
"children": null,\
"options": [\
{\
"title": "Всех должностей",\
"value": 0,\
"is_disabled": false},\
{\
"title": "Администратор",\
"value": 1234,\
"is_disabled": false}],\
"type": {\
"slug": "allowed_id",\
"all_access_value": 0,\
"no_access_value": 0}}],\
"options": null,\
"type": {\
"slug": "has_group_access",\
"all_access_value": true,\
"no_access_value": false}}]}],
"meta": { }}`

## [tag/Polzovateli/operation/api.location.users.roles.list.user](https://developers.yclients.com/ru/\#tag/Polzovateli/operation/api.location.users.roles.list.user) Получение списка ролей в контексте существующего пользователя

get/company/{company\_id}/users/{user\_id}/roles

https://api.yclients.com/api/v1/company/{company\_id}/users/{user\_id}/roles

Возвращает список ролей пользователей вместе с правами для каждой роли. Позволяет увидеть возможность изменить конкретные права (поле `is_editable`) у существующего пользователя филиала в зависимости от набора прав пользователя, от имени которого выполняется запрос.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |
| user\_id<br>required | number<br>Example:123<br>Идентификатор пользователя. |

##### query Parameters

|     |     |
| --- | --- |
| include | Array of strings<br>ItemsValue:"user\_permissions"<br>Набор сущностей, которые должны быть включены в ответ. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | Array of objects (Объект модели "Роль пользователя") |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

### Response samples

- 200
- 401
- 403
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"slug": "worker",\
"title": "Сотрудник",\
"description": "Оказывает услуги",\
"weight": 1,\
"user_permissions": [\
{\
"slug": "timetable_access",\
"title": "Журнал записей",\
"hint": "",\
"is_recommended": true,\
"is_editable": true,\
"default_value": true,\
"entity_name": null,\
"children": [\
{\
"slug": "timetable_position_id",\
"title": "Просматривать расписание и записи должностей",\
"hint": "",\
"is_recommended": true,\
"is_editable": true,\
"default_value": null,\
"entity_name": "position",\
"children": null,\
"options": [\
{\
"title": "Всех должностей",\
"value": 0,\
"is_disabled": false},\
{\
"title": "Администратор",\
"value": 1234,\
"is_disabled": false}],\
"type": {\
"slug": "allowed_id",\
"all_access_value": 0,\
"no_access_value": 0}}],\
"options": null,\
"type": {\
"slug": "has_group_access",\
"all_access_value": true,\
"no_access_value": false}}]}],
"meta": { }}`

## [tag/Polzovateli/operation/api.location.users.permissions.user](https://developers.yclients.com/ru/\#tag/Polzovateli/operation/api.location.users.permissions.user) Получение значений прав и роли пользователя

get/company/{company\_id}/users/{user\_id}/permissions

https://api.yclients.com/api/v1/company/{company\_id}/users/{user\_id}/permissions

Возвращает роль пользователя и список прав со значениями.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |
| user\_id<br>required | number<br>Example:123<br>Идентификатор пользователя. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object (Объект модели "Права и роль пользователя") <br>Данные по правам и роли пользователя |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

### Response samples

- 200
- 401
- 403
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"is_editable": true,
"staff_id": 12345,
"user_role": "owner",
"user_permissions": [\
{\
"slug": "timetable_access",\
"value": true},\
{\
"slug": "timetable_position_id",\
"value": 0},\
{\
"slug": "auth_list_allowed_ip",\
"value": ""}]},
"meta": { }}`

## [tag/Polzovateli/operation/api.location.users.permissions.user.save](https://developers.yclients.com/ru/\#tag/Polzovateli/operation/api.location.users.permissions.user.save) Обновление прав и роли пользователя

put/company/{company\_id}/users/{user\_id}/permissions

https://api.yclients.com/api/v1/company/{company\_id}/users/{user\_id}/permissions

Обновляет роль и права пользователя, а так же сотрудника который к этому пользователю прикреплен.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |
| user\_id<br>required | number<br>Example:123<br>Идентификатор пользователя. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| user\_role | string<br>Enum:"worker""administrator""accountant""manager""owner"<br>Название роли |
| user\_permissions | Array of items<br>Список значений прав пользователя |
| staff\_id | number<br>Идентификатор сотрудника привязанного к пользователю |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object (Объект модели "Права и роль пользователя") <br>Данные по правам и роли пользователя |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"user_role": "worker",
"user_permissions": [\
{\
"slug": "timetable_access",\
"value": true}],
"staff_id": 0}`

### Response samples

- 200
- 401
- 403
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"is_editable": true,
"staff_id": 12345,
"user_role": "owner",
"user_permissions": [\
{\
"slug": "timetable_access",\
"value": true},\
{\
"slug": "timetable_position_id",\
"value": 0},\
{\
"slug": "auth_list_allowed_ip",\
"value": ""}]},
"meta": { }}`

## [tag/Polzovateli/operation/api.location.users.permissions.user.copy_to_companies](https://developers.yclients.com/ru/\#tag/Polzovateli/operation/api.location.users.permissions.user.copy_to_companies) Копирование пользователя в филиалы

post/company/{company\_id}/users/{user\_id}/copy\_to\_companies

https://api.yclients.com/api/v1/company/{company\_id}/users/{user\_id}/copy\_to\_companies

Копирует пользователя с правами в несколько указанных филиалов. Если пользователя ранее не было в этих филиалах, он будет добавлен в них как активный. Если пользователь был приглашен в филиал, будут обновлены только его права, пользователю по-прежнему будет необходимо принять приглашение.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |
| user\_id<br>required | number<br>Example:123<br>Идентификатор пользователя. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| user\_company\_links<br>required | Array of objectsnon-emptyunique<br>Список филиалов, куда необходимо скопировать права пользователя |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"user_company_links": [\
{\
"company_id": 123,\
"user_permissions": [\
{\
"slug": "timetable_access",\
"value": true}]}]}`

### Response samples

- 200
- 401
- 403
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": null,
"meta": { }}`

## [tag/Polzovateli/operation/api.location.users.permissions.user.remove_from_companies](https://developers.yclients.com/ru/\#tag/Polzovateli/operation/api.location.users.permissions.user.remove_from_companies) Удаление пользователя из филиалов

post/company/{company\_id}/users/{user\_id}/remove\_from\_companies

https://api.yclients.com/api/v1/company/{company\_id}/users/{user\_id}/remove\_from\_companies

Удаляет пользователя из нескольких указанных филиалов.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |
| user\_id<br>required | number<br>Example:123<br>Идентификатор пользователя. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| user\_company\_links<br>required | Array of objectsnon-emptyunique<br>Список филиалов, откуда необходимо удалить пользователя |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"user_company_links": [\
{\
"company_id": 123}]}`

### Response samples

- 200
- 401
- 403
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": null,
"meta": { }}`

# [tag/Polzovatel](https://developers.yclients.com/ru/\#tag/Polzovatel) Пользователь

Описание разделов прав доступа:

| Значение | Описание |
| --- | --- |
| 'settings' | Список прав относящиеся к группе настройки |
| 'finances' | Список прав относящиеся к группе финансы |
| 'loyalty' | Список прав относящиеся к группе лояльность |
| 'notification' | Список прав относящиеся к группе уведомления |
| 'storages' | Список прав относящиеся к группе склады |
| 'clients' | Список прав относящиеся к группе клиенты |
| 'dashboard' | Список прав относящиеся к группе журнал записей |

В списке прав содержатся следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| timetable\_access | boolean | true - есть доступ к журналу записи, false - нет доступа |
| master\_id | number | 0 - если пользователь может просматривать расписание и записи всех сотрудников, иначе только того сотрудника, ID которого задан |
| position\_id | number | 0 - если пользователь может просматривать расписание и записи всех сотрудников, иначе только ту должность, ID которого задан |
| last\_days\_count | number | 0 - не ограничить доступ к истории расписаний и записям |
| schedule\_edit\_access | boolean | true - есть доступ к графику работы сотрудника в журнале, false - нет доступа |
| timetable\_phones\_access | boolean | true - есть доступ к номеру телефона в журнале записи, false - нет доступа |
| timetable\_transferring\_record\_access | boolean | true - есть доступ к переносу записей, false - нет доступа |
| timetable\_statistics\_access | boolean | true - есть доступ к просмотру статистики, false - нет доступа |
| record\_form\_access | boolean | true - есть доступ к окну записи, false - нет доступа |
| record\_form\_client\_access | boolean | true - есть доступ к данным клиентов, false - нет доступа |
| records\_autocomplete\_access | boolean | true - есть доступ к выпадающему списку с данными о клиентах, false - нет доступа |
| create\_records\_access | boolean | true - есть доступ к созданию записей, false - нет доступа Создавать записи |
| edit\_records\_access | boolean | true - есть доступ к изменение записей, false - нет доступа |
| edit\_records\_attendance\_access | boolean | true - есть доступ к записям со статусом визита "клиент пришел", false - нет доступа |
| records\_services\_cost\_access | boolean | true - есть доступ к изменению стоимости услуг, false - нет доступа |
| records\_services\_discount\_access | boolean | true - есть доступ к изменению скидки на услуги, false - нет доступа |
| record\_edit\_full\_paid\_access | boolean | true - есть доступ к редактированию оплаченной записи, false - нет доступа |
| delete\_records\_access | boolean | true - есть доступ к удалению записи, false - нет доступа |
| delete\_customer\_came\_records\_access | boolean | true - есть доступ к удалению записей со статусом "клиент пришел", false - нет доступа |
| delete\_paid\_records\_access | boolean | true - есть доступ к удалению оплаченных записей, false - нет доступа |
| records\_goods\_access | boolean | true - есть доступ к продажам товаров, false - нет доступа |
| records\_goods\_create\_transaction\_access | boolean | true - есть доступ к созданию товарных транзакций, false - нет доступа |
| records\_goods\_create\_last\_days\_count | number | -1 - есть доступ к созданию товарных транзакций за все время, >= 0 - доступ к созданию товарных транзакций за указанное количество дней прошлое |
| records\_goods\_edit\_transaction\_access | boolean | true - есть доступ к редактированию товарных транзакций, false - нет доступа |
| records\_goods\_edit\_last\_days\_count | number | -1 - есть доступ к редактированию товарных транзакций за все время, >= 0 - доступ к редактированию товарных транзакций за указанное количество дней прошлое |
| records\_goods\_cost\_access | boolean | true - есть доступ к изменению стоимость товаров, false - нет доступа |
| records\_goods\_discount\_access | boolean | true - есть доступ к изменению скидки на товары, false - нет доступа |
| records\_finances\_access | boolean | true - есть доступ к оплате, false - нет доступа |
| records\_finances\_last\_days\_count | number | -1 - есть доступ к проведению оплаты в записях за все время, >= 0 - доступ к проведению оплаты в записях за указанное количество дней прошлое |
| records\_finances\_pay\_from\_deposits\_access | boolean | true - есть доступ к проведению оплаты в записях с личного счета клиента, false - нет доступа |
| records\_group\_id\_access | boolean | true - есть доступ к данным клиентов по сети, false - нет доступа |
| records\_group\_id | number | ID сети к которой есть доступ к данным клиентов |
| finances\_access | boolean | true - есть доступ к финансам, false - нет доступа |
| finances\_accounts\_ids | array | массив ID к выбранным кассам |
| finances\_transactions\_access | boolean | true - есть доступ к просмотру движений средств, false - нет доступа |
| finances\_last\_days\_count | number | -1 - есть доступ к просмотру движений средств за все время, >= 0 - доступ к просмотру движений средств за указанное количество дней прошлое |
| finances\_create\_transactions\_access | boolean | true - есть доступ к созданию транзакций, false - нет доступа |
| finances\_create\_last\_days\_count | number | -1 - есть доступ к созданию транзакций за все время, >= 0 - доступ к созданию транзакций за указанное количество дней прошлое |
| finances\_edit\_transactions\_access | boolean | true - есть доступ к редактированию транзакций, false - нет доступа |
| finances\_edit\_last\_days\_count | number | -1 - есть доступ к редактированию транзакций за все время, >= 0 - доступ к редактированию транзакций за указанное количество дней прошлое |
| finances\_delete\_transactions\_access | boolean | true - есть доступ к удалению транзакций, false - нет доступа |
| finances\_transactions\_excel\_access | boolean | true - есть доступ к выгрузке движений средств в Excel, false - нет доступа |
| finances\_expenses\_ids | array | true - есть доступ к переводам между кассами, false - нет доступа |
| finances\_accounts\_access | boolean | true - есть доступ к счетам и кассам, false - нет доступа |
| finances\_accounts\_banalce\_access | boolean | true - есть доступ к балансу, false - нет доступа |
| finances\_suppliers\_read\_access | boolean | true - есть доступ к контрагентам, false - нет доступа |
| finances\_suppliers\_create\_access | boolean | true - есть доступ к созданию контрагентов, false - нет доступа |
| finances\_suppliers\_update\_access | boolean | true - есть доступ к изменению контрагентов, false - нет доступа |
| finances\_suppliers\_delete\_access | boolean | true - есть доступ к удалению контрагентов, false - нет доступа |
| finances\_suppliers\_excel\_access | boolean | true - есть доступ к выгрузке в Excel, false - нет доступа |
| finances\_expenses\_read\_access | boolean | true - есть доступ к статье платежей, false - нет доступа |
| expenses\_read\_access | boolean | true - есть доступ к статье платежей, false - нет доступа |
| finances\_expenses\_create\_access | boolean | true - есть доступ к созданию статьи платежа, false - нет доступа |
| expenses\_create\_access | boolean | true - есть доступ к созданию статьи платежа, false - нет доступа |
| finances\_expenses\_update\_access | boolean | true - есть доступ к изменению статьи платежа, false - нет доступа |
| expenses\_update\_access | boolean | true - есть доступ к изменению статьи платежа, false - нет доступа |
| finances\_expenses\_delete\_access | boolean | true - есть доступ к удалению статьи платежа, false - нет доступа |
| expenses\_delete\_access | boolean | true - есть доступ к удалению статьи платежа, false - нет доступа |
| finances\_kkm\_transactions\_access | boolean | true - есть доступ к операциям с KKM, false - нет доступа |
| kkm\_transactions\_accounts\_access | boolean | true - есть доступ к операциям с KKM, false - нет доступа |
| finances\_kkm\_settings\_read\_access | boolean | true - есть доступ к настройкам KKM, false - нет доступа |
| kkm\_settings\_reed\_access | boolean | true - есть доступ к настройкам KKM, false - нет доступа |
| finances\_kkm\_settings\_update\_access | boolean | true - есть доступ к изменению KKM, false - нет доступа |
| kkm\_settings\_update\_access | boolean | true - есть доступ к изменению KKM, false - нет доступа |
| finances\_settings\_invoicing\_read\_access | boolean | true - есть доступ к онлайн-оплатам, false - нет доступа |
| finances\_settings\_invoicing\_update\_access | boolean | true - есть доступ к изменению онлайн-оплат, false - нет доступа |
| settings\_invoicing\_update\_access | boolean | true - есть доступ к изменению онлайн-оплат, false - нет доступа |
| finances\_options\_read\_access | boolean | true - есть доступ к настройкам оплаты, false - нет доступа |
| finances\_options\_update\_access | boolean | true - есть доступ к изменению настроек оплаты, false - нет доступа |
| options\_update\_access | boolean | true - есть доступ к изменению настроек оплаты, false - нет доступа |
| finances\_salary\_schemes\_access | boolean | true - есть доступ к схемам расчета заработной платы, false - нет доступа |
| finances\_salary\_calc\_access | boolean | true - есть доступ к расчету заработной платы, false - нет доступа |
| finances\_salary\_not\_limitation\_today\_access | boolean | true - есть доступ к расчету заработной платы, false - доступ к расчету заработной платы за текущий день |
| finances\_payroll\_calculation\_create\_access | boolean | true - есть доступ к начислению заработной платы, false - нет доступа |
| finances\_payroll\_calculation\_create\_not\_limitation\_today\_access | boolean | true - есть доступ к начислению заработной платы, false - доступ к начислению заработной платы за текущий день |
| finances\_salary\_access\_master\_checkbox | boolean | true - есть доступ к расчету заработной платы только конкретного сотрудника, false - полный доступ |
| finances\_salary\_access\_master\_id | number | ID сотрудника к которому есть доступ на расчет заработной платы |
| get\_salary\_access\_master\_id | number | ID сотрудника к которому есть доступ на расчет заработной платы |
| finances\_salary\_master\_not\_limitation\_today\_access | boolean | true - не ограничивать текущим днем, false - доступ только на сегодняшний день |
| finances\_payroll\_calculation\_create\_by\_master\_access | boolean | true - есть доступ к начислению заработной платы по конкретному сотруднику, false - без ограничений |
| calculation\_create\_by\_master\_not\_limitation\_today\_access | boolean | true - есть доступ к начислению заработной платы, false - нет доступа |
| finances\_period\_report\_access | boolean | true - есть доступ к отчету за период, false - нет доступа |
| finances\_period\_report\_excel\_access | boolean | true - есть доступ к выгрузке в Excel отчета за период, false - нет доступа |
| finances\_year\_report\_access | boolean | true - есть доступ к годовому отчету, false - нет доступа |
| finances\_year\_report\_excel\_access | boolean | true - есть доступ к выгрузке в Excel годового отчета, false - нет доступа |
| finances\_print\_check\_access | boolean | true - есть доступ к печати чека, false - нет доступа |
| finances\_z\_report\_access | boolean | true - есть доступ к отчету по кассе за день, false - нет доступа |
| finances\_z\_report\_no\_limit\_today\_access | boolean | true - есть доступ к отчету по кассе, false - доступ к отчету по кассе за текущий день |
| finances\_z\_report\_excel\_access | boolean | true - есть доступ к выгрузке в Excel, false - нет доступа |
| clients\_access | boolean | true - есть доступ к клиентской базе, false - нет доступа |
| clients\_phones\_email\_access | boolean | true - есть доступ к номерам телефонов и email в списке клиентов, false - нет доступа |
| client\_phones\_access | boolean | true - есть доступ к номерам телефонов в списке клиентов, false - нет доступа |
| clients\_card\_phone\_access | boolean | true - есть доступ к телефонам в карточке клиента, false - нет доступа |
| clients\_delete\_access | boolean | true - есть доступ к удалению клиентов, false - нет доступа |
| clients\_excel\_access | boolean | true - есть доступ к выгрузке списка клиентов в Excel, false - нет доступа |
| excel\_access | number | 1 - есть доступ к выгрузке списка клиентов в Excel, 0 - нет доступа |
| client\_comments\_list\_access | boolean | true - есть доступ к просмотру комментарии, false - нет доступа |
| client\_comments\_add\_access | boolean | true - есть доступ к добавлению комментарии, false - нет доступа |
| client\_comments\_own\_edit\_access | boolean | true - есть доступ к изменению/удалению своих комментарии, false - нет доступа |
| client\_comments\_other\_edit\_access | boolean | true - есть доступ к изменению/удалению чужих комментарии, false - нет доступа |
| client\_files\_list\_access | boolean | true - есть доступ к просмотрам и скачиванию файлов, false - нет доступа |
| client\_files\_upload\_access | boolean | true - есть доступ к загрузке файлов, false - нет доступа |
| client\_files\_delete\_access | boolean | true - есть доступ к удалению файлов, false - нет доступа |
| clients\_visit\_master\_id | number | ID мастера по которому можно посмотреть клиентов посещавшие мастера, 0 - без ограничений |
| get\_visit\_master\_id | number | ID мастера по которому можно посмотреть клиентов посещавшие мастера, 0 - без ограничений |
| dashboard\_access | boolean | true - есть доступ к разделу обзор, false - нет доступа |
| dash\_access | boolean | true - есть доступ к разделу сводка, false - нет доступа |
| dash\_phones\_access | boolean | true - есть доступ к показу номера телефонов в сводке, false - нет доступа |
| dash\_records\_access | boolean | true - есть доступ к просмотру списка записей, false - нет доступа |
| dash\_records\_last\_days\_count | number | -1 - есть доступ к просмотру списка записей за все время, >= 0 - доступ к просмотру списка записей за указанное количество дней прошлое |
| dash\_records\_excel\_access | boolean | true - есть доступ к выгрузке списка записей в Excel, false - нет доступа |
| dash\_records\_phones\_access | boolean | true - есть доступ к показу номера телефонов в записях, false - нет доступа |
| dash\_message\_access | boolean | true - есть доступ к просмотру детализаций сообщений, false - нет доступа |
| dash\_message\_excel\_access | boolean | true - есть доступ к выгрузке детализаций сообщений в Excel, false - нет доступа |
| dash\_message\_phones\_access | boolean | true - есть доступ к показу номера телефонов в сообщениях, false - нет доступа |
| dash\_reviews\_access | boolean | true - есть доступ к просмотру отзывов, false - нет доступа |
| dash\_reviews\_delete\_access | boolean | true - есть доступ к удалению отзывов, false - нет доступа |
| dashboard\_calls\_access | boolean | true - есть доступ к разделу звонки, false - нет доступа |
| dashboard\_calls\_excel\_access | boolean | true - есть доступ к выгрузке звонков Excel, false - нет доступа |
| dashboard\_calls\_phones\_access | boolean | true - есть доступ к просмотру номера телефона у клиентов, false - нет доступа |
| notification | boolean | true - есть доступ к Уведомления, false - нет доступа |
| web\_push | boolean | true - есть доступ к показу Push уведомлений о записях в Web-версии, false - нет доступа |
| web\_phone\_push | boolean | true - есть доступ к показу Push уведомлений о звонках в Web-версии, false - нет доступа |
| notification\_sms\_ending\_license | boolean | true - есть доступ к отправки SMS уведомлений о скором окончании лицензии, false - нет доступа |
| notification\_sms\_low\_balance | boolean | true - есть доступ к отправки SMS уведомлений о низком балансе, false - нет доступа |
| notification\_email\_ending\_license | boolean | true - есть доступ к отправки Email уведомлений о скором окончании лицензии, false - нет доступа |
| loyalty\_access | boolean | true - есть доступ к лояльности, false - нет доступа |
| has\_loyalty\_access | boolean | true - есть доступ к лояльности, false - нет доступа |
| loyalty\_cards\_manual\_transactions\_access | boolean | true - есть доступ к ручному пополнению/списанию с карт лояльности, false - нет доступа |
| has\_loyalty\_cards\_manual\_transactions\_access | boolean | true - есть доступ к ручному пополнению/списанию с карт лояльности, false - нет доступа |
| loyalty\_certificate\_and\_abonement\_manual\_transactions\_access | boolean | true - есть доступ к оплате сертификатом и абонементом без кода, false - нет доступа |
| storages\_access | boolean | true - есть доступ к складу, false - нет доступа |
| storages\_ids | boolean | true - есть доступ к выбранным складам, false - нет доступа |
| storages\_transactions\_access | boolean | true - есть доступ к просмотру движений товаров, false - нет доступа |
| storages\_last\_days\_count | number | -1 - есть доступ к просмотру движений товаров за все время, >= 0 - доступ к просмотру движений товаров за указанное количество дней прошлое |
| storages\_move\_goods\_access | boolean | true - есть доступ к перемещение товаров между складами, false - нет доступа |
| storages\_create\_transactions\_access | boolean | true - есть доступ к созданию товарных транзакций, false - нет доступа |
| storages\_create\_last\_days\_count | number | -1 - есть доступ к создание товарных транзакций за все время, >= 0 - доступ к создание товарных транзакций за указанное количество дней прошлое |
| storages\_create\_transactions\_buy\_access | boolean | true - есть доступ к оформлению прихода товаров, false - нет доступа |
| storages\_create\_transactions\_sale\_access | boolean | true - есть доступ к оформлению продаж товаров, false - нет доступа |
| storages\_edit\_transactions\_access | boolean | true - есть доступ к редактированию товарных транзакций, false - нет доступа |
| storages\_edit\_last\_days\_count | number | -1 - есть доступ к редактированию товарных транзакций за все время, >= 0 - доступ к редактированию товарных транзакций за указанное количество дней прошлое |
| storages\_edit\_transactions\_buy\_access | boolean | true - есть доступ к оформлению прихода товаров, false - нет доступа |
| storages\_edit\_transactions\_sale\_access | boolean | true - есть доступ к оформлению продаж товаров, false - нет доступа |
| storages\_delete\_transactions\_access | boolean | true - есть доступ к удалению товарных транзакций, false - нет доступа |
| storages\_transactions\_excel\_access | boolean | true - есть доступ к выгрузке движений товаров в Excel, false - нет доступа |
| storages\_transactions\_types | boolean | true - есть доступ к выгрузке движений товаров в Excel, false - нет доступа |
| storages\_inventory\_access | boolean | true - есть доступ к инвентаризации, false - нет доступа |
| storages\_inventory\_create\_edit\_access | boolean | true - есть доступ к созданию и редактированию инвентаризации, false - нет доступа |
| storages\_inventory\_delete\_access | boolean | true - есть доступ к удалению инвентаризации, false - нет доступа |
| storages\_inventory\_excel\_access | boolean | true - есть доступ к выгрузке инвентаризации в Excel, false - нет доступа |
| storages\_remnants\_report\_access | boolean | true - есть доступ к отчету остатков на складе, false - нет доступа |
| storages\_remnants\_report\_excel\_access | boolean | true - есть доступ к выгрузке остатков в Excel, false - нет доступа |
| storages\_sales\_report\_access | boolean | true - есть доступ к отчету по продажам, false - нет доступа |
| storages\_sales\_report\_excel\_access | boolean | true - есть доступ к выгрузке отчета по продажам в Excel, false - нет доступа |
| storages\_consumable\_report\_access | boolean | true - есть доступ к отчету по списанию расходников, false - нет доступа |
| storages\_consumable\_report\_excel\_access | boolean | true - есть доступ к выгрузке отчета по списанию расходников в Excel, false - нет доступа |
| storages\_write\_off\_report\_access | boolean | true - есть доступ к отчету по списанию товаров, false - нет доступа |
| storages\_write\_off\_report\_excel\_access | boolean | true - есть доступ к выгрузке отчета по списанию товаров в Excel, false - нет доступа |
| storages\_turnover\_report\_access | boolean | true - есть доступ к отчету по оборачиваемости, false - нет доступа |
| storages\_turnover\_report\_excel\_access | boolean | true - есть доступ к выгрузке отчета по оборачиваемости в Excel, false - нет доступа |
| storages\_goods\_crud\_access | boolean | true - есть доступ к управлению товарами, false - нет доступа |
| storages\_goods\_create\_access | boolean | true - есть доступ к созданию товаров, false - нет доступа |
| storages\_goods\_update\_access | boolean | true - есть доступ к изменению товаров, false - нет доступа |
| storages\_goods\_title\_edit\_access | boolean | true - есть доступ к названию, Артикул, Штрих-код, false - нет доступа |
| storages\_goods\_category\_edit\_access | boolean | true - есть доступ к категориям, false - нет доступа |
| storages\_goods\_selling\_price\_edit\_access | boolean | true - есть доступ к ценам продажи, false - нет доступа |
| storages\_goods\_cost\_price\_edit\_access | boolean | true - есть доступ к себестоимости, false - нет доступа |
| storages\_goods\_units\_edit\_access | boolean | true - есть доступ к единицам измерения, false - нет доступа |
| storages\_goods\_critical\_balance\_edit\_access | boolean | true - есть доступ к критичным остаткам, Желаемый остаток, false - нет доступа |
| storages\_goods\_masses\_edit\_access | boolean | true - есть доступ к массе, false - нет доступа |
| storages\_goods\_comment\_edit\_access | boolean | true - есть доступ к комментариям, false - нет доступа |
| storages\_goods\_archive\_access | boolean | true - есть доступ к архивации и восстановлению товаров, false - нет доступа |
| storages\_goods\_delete\_access | boolean | true - есть доступ к удалению товаров, false - нет доступа |
| settings\_access | boolean | true - есть доступ к разделу настройки, false - нет доступа |
| settings\_basis\_access | boolean | true - есть доступ к разделу Основные, false - нет доступа |
| settings\_information\_access | boolean | true - есть доступ к разделу Информация, false - нет доступа |
| users\_access | boolean | true - есть доступ к управлению пользователями, false - нет доступа |
| delete\_users\_access | boolean | true - есть доступ к удалению пользователей, false - нет доступа |
| create\_users\_access | boolean | true - есть доступ к добавлению пользователей, false - нет доступа |
| edit\_users\_access | boolean | true - есть доступ к управлению правами пользователей, false - нет доступа |
| limited\_users\_access | boolean | true - есть доступ к управлению правами в рамках своего набора прав, false - нет доступа |
| settings\_services\_access | boolean | true - есть доступ к разделу Услуги, false - нет доступа |
| settings\_services\_create\_access | boolean | true - есть доступ к созданию услуг, false - нет доступа |
| services\_edit | boolean | true - есть доступ к редактированию услуг, false - нет доступа |
| settings\_services\_edit\_title\_access | boolean | true - есть доступ к названиям услуг и название для онлайн-записи, false - нет доступа |
| settings\_services\_relation\_category\_access | boolean | true - есть доступ к категориям услуги, false - нет доступа |
| settings\_services\_edit\_price\_access | boolean | true - есть доступ к ценам услуг, false - нет доступа |
| settings\_services\_edit\_image\_access | boolean | true - есть доступ к загрузкам и изменениям изображений, false - нет доступа |
| settings\_services\_edit\_online\_seance\_date\_time\_access | boolean | true - есть доступ к отображениям услуг в виджете, false - нет доступа |
| settings\_services\_edit\_online\_pay\_access | boolean | true - есть доступ к онлайн-оплате услуги, false - нет доступа |
| settings\_services\_edit\_services\_related\_resource\_access | boolean | true - есть доступ к ресурсам услуги, false - нет доступа |
| settings\_positions\_read | boolean | true - есть доступ к разделу должности, false - нет доступа |
| settings\_positions\_create | boolean | true - есть доступ к созданию должностей, false - нет доступа |
| settings\_positions\_delete | boolean | true - есть доступ к удалению должностей, false - нет доступа |
| edit\_master\_service\_and\_duration | boolean | true - есть доступ к изменению услуги сотрудников и их длительность, false - нет доступа |
| tech\_card\_edit | boolean | true - есть доступ к изменению технологической карты, false - нет доступа |
| services\_delete | boolean | true - есть доступ к удалению услуг, false - нет доступа |
| settings\_master\_access | boolean | true - есть доступ к разделу Сотрудники, false - нет доступа |
| master\_create | boolean | true - есть доступ к созданию сотрудников, false - нет доступа |
| master\_edit | boolean | true - есть доступ к редактированию сотрудников, false - нет доступа |
| master\_delete | boolean | true - есть доступ к удалению сотрудников, false - нет доступа |
| settings\_master\_dismiss\_access | boolean | true - есть доступ к увольнению сотрудников, false - нет доступа |
| schedule\_edit | boolean | true - есть доступ к редактированию графика работы, false - нет доступа |
| settings\_notifications\_access | boolean | true - есть доступ к разделу Sms уведомления, false - нет доступа |
| settings\_email\_notifications\_access | boolean | true - есть доступ к разделу Email уведомления, false - нет доступа |
| settings\_template\_notifications\_access | boolean | true - есть доступ к разделу Типы уведомлений, false - нет доступа |
| webhook\_read\_access | boolean | true - есть доступ к изменению настроек WebHook, false - нет доступа |
| stat\_access | boolean | true - есть доступ к аналитике, false - нет доступа |
| billing\_access | boolean | true - есть доступ к биллингу (раздел меню баланс), false - нет доступа |
| send\_sms | boolean | true - есть доступ к SMS рассылки клиентам, false - нет доступа |
| auth\_enable\_check\_ip | boolean | true - есть доступ к филиалу только с IP-адресов (v4, v6), false - нет доступа |
| auth\_list\_allowed\_ip | array | список IP адресов |

- Параметр
  - company\_id (required, number, `1`) \- ID компани

## [tag/Polzovatel/operation/Получить список прав](https://developers.yclients.com/ru/\#tag/Polzovatel/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%BE%D0%BA%20%D0%BF%D1%80%D0%B0%D0%B2) Получить список прав

get/user/permissions/{company\_id}

https://api.yclients.com/api/v1/user/permissions/{company\_id}

- Параметр
  - company\_id (required, number, `1`) \- ID компании

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object<br>Объект с категориями прав доступа |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"timetable": {
"timetable_access": true,
"master_id": 1000238,
"position_id": 0,
"last_days_count": 1000,
"schedule_edit_access": true,
"timetable_phones_access": true,
"timetable_transferring_record_access": true,
"timetable_statistics_access": true},
"record_form": {
"record_form_access": true,
"record_form_client_access": true,
"records_autocomplete_access": true,
"create_records_access": true,
"edit_records_access": true,
"edit_records_attendance_access": true,
"records_services_cost_access": true,
"records_services_discount_access": true,
"record_edit_full_paid_access": true,
"delete_records_access": true,
"delete_customer_came_records_access": true,
"delete_paid_records_access": true,
"records_goods_access": true,
"records_goods_create_transaction_access": true,
"records_goods_create_last_days_count": -1,
"records_goods_edit_transaction_access": true,
"records_goods_edit_last_days_count": -1,
"records_goods_cost_access": true,
"records_goods_discount_access": true,
"records_finances_access": true,
"records_finances_last_days_count": -1,
"records_finances_pay_from_deposits_access": true,
"records_group_id_access": true,
"records_group_id": 134178},
"finances": {
"finances_access": true,
"finances_accounts_ids": [ ],
"finances_transactions_access": true,
"finances_last_days_count": -1,
"finances_create_transactions_access": true,
"finances_create_last_days_count": -1,
"finances_edit_transactions_access": true,
"finances_edit_last_days_count": -1,
"finances_delete_transactions_access": true,
"finances_transactions_excel_access": true,
"finances_expenses_ids": [ ],
"finances_accounts_access": true,
"finances_accounts_banalce_access": true,
"finances_suppliers_read_access": true,
"finances_suppliers_create_access": true,
"finances_suppliers_update_access": true,
"finances_suppliers_delete_access": true,
"finances_suppliers_excel_access": true,
"finances_expenses_read_access": true,
"expenses_read_access": true,
"finances_expenses_create_access": true,
"expenses_create_access": true,
"finances_expenses_update_access": true,
"expenses_update_access": true,
"finances_expenses_delete_access": true,
"expenses_delete_access": true,
"finances_kkm_transactions_access": true,
"kkm_transactions_accounts_access": true,
"finances_kkm_settings_read_access": true,
"kkm_settings_reed_access": true,
"finances_kkm_settings_update_access": true,
"kkm_settings_update_access": true,
"finances_settings_invoicing_read_access": true,
"settings_invoicing_read_access": true,
"finances_settings_invoicing_update_access": true,
"settings_invoicing_update_access": true,
"finances_options_read_access": true,
"options_read_access": true,
"finances_options_update_access": true,
"options_update_access": true,
"finances_salary_schemes_access": true,
"finances_salary_calc_access": true,
"finances_salary_not_limitation_today_access": true,
"finances_payroll_calculation_create_access": true,
"finances_payroll_calculation_create_not_limitation_today_access": true,
"finances_salary_access_master_checkbox": true,
"finances_salary_access_master_id": 1000237,
"get_salary_access_master_id": 1000237,
"finances_salary_master_not_limitation_today_access": true,
"finances_payroll_calculation_create_by_master_access": true,
"calculation_create_by_master_not_limitation_today_access": true,
"finances_period_report_access": true,
"finances_period_report_excel_access": true,
"finances_year_report_access": true,
"finances_year_report_excel_access": true,
"finances_print_check_access": true,
"finances_z_report_access": true,
"finances_z_report_no_limit_today_access": true,
"finances_z_report_excel_access": true},
"clients": {
"clients_access": true,
"client_phones_access": true,
"clients_phones_email_access": true,
"clients_card_phone_access": true,
"clients_delete_access": true,
"clients_excel_access": true,
"excel_access": true,
"client_comments_list_access": true,
"client_comments_add_access": true,
"client_comments_own_edit_access": true,
"client_comments_other_edit_access": true,
"client_files_list_access": true,
"client_files_upload_access": true,
"client_files_delete_access": true,
"clients_visit_master_id": 0,
"get_visit_master_id": 0},
"dashboard": {
"dashboard_access": true,
"dash_access": true,
"dash_phones_access": true,
"dash_records_access": true,
"dash_records_last_days_count": -1,
"dash_records_excel_access": true,
"dash_records_phones_access": true,
"dash_message_access": true,
"dash_message_excel_access": true,
"dash_message_phones_access": true,
"dash_reviews_access": true,
"dash_reviews_delete_access": true,
"dashboard_calls_access": true,
"dashboard_calls_excel_access": true,
"dashboard_calls_phones_access": true},
"notification": {
"notification": true,
"web_push": true,
"web_phone_push": true,
"notification_sms_ending_license": true,
"notification_sms_low_balance": true,
"notification_email_ending_license": true},
"loyalty": {
"loyalty_access": true,
"has_loyalty_access": true,
"loyalty_cards_manual_transactions_access": true,
"has_loyalty_cards_manual_transactions_access": true,
"loyalty_certificate_and_abonement_manual_transactions_access": true},
"storages": {
"storages_access": true,
"storages_ids": [ ],
"storages_transactions_access": true,
"storages_last_days_count": -1,
"storages_move_goods_access": true,
"storages_create_transactions_access": true,
"storages_create_last_days_count": -1,
"storages_create_transactions_buy_access": true,
"storages_create_transactions_sale_access": true,
"storages_edit_transactions_access": true,
"storages_edit_last_days_count": -1,
"storages_edit_transactions_buy_access": true,
"storages_edit_transactions_sale_access": true,
"storages_delete_transactions_access": true,
"storages_transactions_excel_access": true,
"storages_transactions_types": [ ],
"storages_inventory_access": true,
"storages_inventory_create_edit_access": true,
"storages_inventory_delete_access": true,
"storages_inventory_excel_access": true,
"storages_remnants_report_access": true,
"storages_remnants_report_excel_access": true,
"storages_sales_report_access": true,
"storages_sales_report_excel_access": true,
"storages_consumable_report_access": true,
"storages_consumable_report_excel_access": true,
"storages_write_off_report_access": true,
"storages_write_off_report_excel_access": true,
"storages_turnover_report_access": true,
"storages_turnover_report_excel_access": true,
"storages_goods_crud_access": true,
"storages_goods_create_access": true,
"storages_goods_update_access": true,
"storages_goods_title_edit_access": true,
"storages_goods_category_edit_access": true,
"storages_goods_selling_price_edit_access": true,
"storages_goods_cost_price_edit_access": true,
"storages_goods_units_edit_access": true,
"storages_goods_critical_balance_edit_access": true,
"storages_goods_masses_edit_access": true,
"storages_goods_comment_edit_access": true,
"storages_goods_archive_access": true,
"storages_goods_delete_access": true},
"settings": {
"settings_access": true,
"settings_basis_access": true,
"settings_information_access": true,
"users_access": true,
"delete_users_access": true,
"create_users_access": true,
"edit_users_access": true,
"limited_users_access": false,
"settings_services_access": true,
"settings_services_create_access": true,
"services_edit": true,
"settings_services_edit_title_access": true,
"settings_services_relation_category_access": true,
"settings_services_edit_price_access": true,
"settings_services_edit_image_access": true,
"settings_services_edit_online_seance_date_time_access": true,
"settings_services_edit_online_pay_access": true,
"settings_services_edit_services_related_resource_access": true,
"settings_positions_read": true,
"settings_positions_create": true,
"settings_positions_delete": true,
"edit_master_service_and_duration": true,
"tech_card_edit": true,
"services_delete": true,
"settings_master_access": true,
"master_create": true,
"master_edit": true,
"master_delete": true,
"settings_master_dismiss_access": true,
"schedule_edit": true,
"settings_notifications_access": true,
"settings_email_notifications_access": true,
"settings_template_notifications_access": true,
"webhook_read_access": true},
"other": {
"stat_access": true,
"billing_access": true,
"send_sms": true,
"auth_enable_check_ip": false,
"auth_list_allowed_ip": [ ]}},
"meta": [ ]}`

## [tag/Polzovatel/operation/api.user.invite.create](https://developers.yclients.com/ru/\#tag/Polzovatel/operation/api.user.invite.create) Создание и отправка приглашения

post/user/invite/{salon\_id}

https://api.yclients.com/api/v1/user/invite/{salon\_id}

Приглашение к управлению филиалом предполагает отправку по e-mail или телефону ссылки. Перейдя по этой ссылке, пользователь после регистрации получает доступ к управлению филиалом в соответствии с назначенными правами.
Назначение прав осуществляется после отправки приглашения отдельным запросом.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| invites<br>required | Array of objects<br>Массив приглашений |

### Responses

**202**
Accepted

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешной отправка (true) |
| data | string<br>Имеет значение null |
| meta | object<br>Метаданные (содержит сообщение о том, что данные сохранены) |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"invites": [\
{\
"name": "Ольга",\
"search": "mail@gmail.com",\
"position": "Администратор",\
"user_role": "administrator",\
"user_permissions": [\
{\
"slug": "timetable_access",\
"value": true}],\
"staff_id": 12}]}`

### Response samples

- 202
- 401
- 403
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"meta": {
"message": "Сохранено"}}`

# [tag/Sotrudniki](https://developers.yclients.com/ru/\#tag/Sotrudniki) Сотрудники

Для работы с сотрудниками используются следующие методы

Объект сотрудника имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | Идентификатор сотрудника |
| api\_id | string\|null | Внешний идентификатор сотрудника |
| name | string | Имя сотрудника |
| specialization | string | Специализация сотрудника |
| position | object | Должность сотрудника |
| weight | number | Вес сотрудника. При выводе сотрудники сортируются по весу, сначала более тяжелые |
| show\_rating | number | Показывать ли рейтинг сотрудника (1 - показывать, 0 - не показывать) |
| rating | number | Ретинг сотрудника |
| votes\_count | number | Кол-во голосов, оценивших сотрудника |
| comments\_count | number | Кол-во комментариев к сотрунику |
| avatar | string | Путь к файлу аватарки сотрудника |
| avatar\_big | string | Путь к файлу аватарки сотрудника в более высоком разрешении |
| information | string | Дополнительная информация о сотруднике (HTML формат) |
| hidden | number | 1 - скрыт от онлайн записей, 0 - не скрыт |
| fired | number | 1 - уволен, 0 - не уволен |
| status | number | Статус удаления сотрудника, 1 - удален, 0 - не удален |
| image\_group | object | Группа изображений сотрудника |

## [tag/Sotrudniki/operation/api.location.staff.create_quick](https://developers.yclients.com/ru/\#tag/Sotrudniki/operation/api.location.staff.create_quick) Быстрое создание сотрудника

post/company/{company\_id}/staff/quick

https://api.yclients.com/api/v1/company/{company\_id}/staff/quick

Создает нового сотрудника в филиале с минимальным набором входных параметров.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| name<br>required | string<br>Имя сотрудника. |
| specialization<br>required | string<br>Специализация сотрудника. |
| position\_id<br>required | number or null<br>Идентификатор должности, к которой необходимо привязать сотрудника. |
| phone\_number<br>required | string or null<br>Номер телефона пользователя, к которому необходимо привязать сотрудника (без "+", от 9 до 15 цифр). |

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object (Объект модели "Сотрудник с Должностью") |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Request samples

- Payload

Content type

application/json

Copy

`{
"name": "Иван Иванов",
"specialization": "Мастер",
"position_id": 123,
"phone_number": "71234567890"}`

### Response samples

- 201
- 401
- 403
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 123,
"name": "Иван Иванов",
"company_id": 123,
"specialization": "Мастер",
"avatar": "https://yclients.com/images/no-master-sm.png",
"avatar_big": "https://yclients.com/images/no-master.png",
"position": {
"id": 123,
"title": "Сотрудник"}},
"meta": { }}`

## [tag/Sotrudniki/operation/Добавить нового сотрудника](https://developers.yclients.com/ru/\#tag/Sotrudniki/operation/%D0%94%D0%BE%D0%B1%D0%B0%D0%B2%D0%B8%D1%82%D1%8C%20%D0%BD%D0%BE%D0%B2%D0%BE%D0%B3%D0%BE%20%D1%81%D0%BE%D1%82%D1%80%D1%83%D0%B4%D0%BD%D0%B8%D0%BA%D0%B0) Устаревшее. Добавить нового сотрудника Deprecated

post/staff/{company\_id}

https://api.yclients.com/api/v1/staff/{company\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| name | string<br>Имя сотрудника |
| specialization | string<br>Специализация сотрудника |
| weight | number<br>Вес сотрудника. При выводе сотрудники сортируются по весу, сначала более тяжелые |
| information | string<br>Информация о сотруднике (HTML-формат) |
| api\_id | string<br>Внещний идентификатор сотрудника |
| hidden | number<br>Статус отображения в онлайн-записи, 1 - скрыт, 0 - не скрыт |
| fired | number<br>Статус увольнения сотрудника, 1 - уволен, 0 - не уволен |
| user\_id | number<br>ID привязанного пользователя, 0 - удалить связь с пользователем |

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | object<br>Метаданные (содержат количество найденных сотрудников) |

### Request samples

- Payload

Content type

application/json

Copy

`{
"name": "Василий",
"specialization": "парикмахер",
"weight": 10,
"information": "Стрижет методом трех рук",
"api_id": "42",
"hidden": 0,
"fired": 0,
"user_id": 123}`

### Response samples

- 201

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 17969,
"api_id": "42",
"name": "Василий",
"specialization": "парикмахер",
"position": {
"id": 1,
"title": "Администратор"},
"show_rating": 0,
"rating": 0,
"votes_count": 0,
"user_id": 12345,
"avatar": "https://yclients.com/uploads/masters/sm/20151018220924_4963.jpg",
"avatar_big": "https://yclients.com/uploads/masters/norm/20151018220924_4963.jpg",
"comments_count": 0,
"weight": 10,
"information": "<span><span><span>&nbsp;</span></span></span>",
"hidden": 0,
"fired": 0,
"status": 0},
"meta": [ ]}`

## [tag/Sotrudniki/operation/Получить список сотрудников / конкретного сотрудника](https://developers.yclients.com/ru/\#tag/Sotrudniki/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%BE%D0%BA%20%D1%81%D0%BE%D1%82%D1%80%D1%83%D0%B4%D0%BD%D0%B8%D0%BA%D0%BE%D0%B2%20/%20%D0%BA%D0%BE%D0%BD%D0%BA%D1%80%D0%B5%D1%82%D0%BD%D0%BE%D0%B3%D0%BE%20%D1%81%D0%BE%D1%82%D1%80%D1%83%D0%B4%D0%BD%D0%B8%D0%BA%D0%B0) Получить список сотрудников / конкретного сотрудника

get/company/{company\_id}/staff/{staff\_id}

https://api.yclients.com/api/v1/company/{company\_id}/staff/{staff\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID филиала |
| staff\_id<br>required | number<br>ID сотрудника, если нужно работать с конкретным сотрудником. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | object<br>Метаданные (содержат количество найденных сотрудников) |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (false) |
| data | string<br>Содержит null |
| meta | object<br>Метаданные (содержит в себе сообщение об ошибке) |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (false) |
| meta | object<br>Метаданные (содержит в себе сообщение об ошибке) |

### Response samples

- 200
- 403
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 1001539,\
"name": "Сотрудник 1",\
"company_id": 176275,\
"specialization": "специалист",\
"position": {\
"id": 1,\
"title": "Администратор"},\
"avatar": "https://yclients.com/images/no-master-sm.png",\
"avatar_big": "https://yclients.com/images/no-master.png",\
"fired": 0,\
"status": 0,\
"hidden": 0,\
"user_id": 12345}],
"meta": {
"total_count": 1}}`

## [tag/Sotrudniki/operation/Устаревшее. Получить список сотрудников / конкретного сотрудника](https://developers.yclients.com/ru/\#tag/Sotrudniki/operation/%D0%A3%D1%81%D1%82%D0%B0%D1%80%D0%B5%D0%B2%D1%88%D0%B5%D0%B5.%20%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%BE%D0%BA%20%D1%81%D0%BE%D1%82%D1%80%D1%83%D0%B4%D0%BD%D0%B8%D0%BA%D0%BE%D0%B2%20/%20%D0%BA%D0%BE%D0%BD%D0%BA%D1%80%D0%B5%D1%82%D0%BD%D0%BE%D0%B3%D0%BE%20%D1%81%D0%BE%D1%82%D1%80%D1%83%D0%B4%D0%BD%D0%B8%D0%BA%D0%B0) Устаревшее. Получить список сотрудников / конкретного сотрудника Deprecated

get/staff/{company\_id}/{staff\_id}

https://api.yclients.com/api/v1/staff/{company\_id}/{staff\_id}

##### Authorizations:

_bearer_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| staff\_id<br>required | number<br>ID сотрудника, если нужно работать с конкретным сотрудником. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": "17969",\
"name": "Василий",\
"specialization": "парикмахер",\
"position": {\
"id": 1,\
"title": "Администратор"},\
"show_rating": "0",\
"rating": "0",\
"user_id": 12345,\
"votes_count": "0",\
"avatar": "https://yclients.com/uploads/masters/sm/20151018220924_4963.jpg",\
"avatar_big": "https://yclients.com/uploads/masters/norm/20151018220924_4963.jpg",\
"comments_count": "0",\
"weight": "10",\
"information": "<span><span><span>&nbsp;</span></span></span>",\
"hidden": "0",\
"fired": "0",\
"status": "0",\
"image_group": {\
"id": 72250,\
"entity": "master",\
"entity_id": 26427,\
"images": {\
"sm": {\
"id": "186817",\
"path": "https://yclients.com/uploads/masters/sm/9/90/9041171cfdabe4c_20170327201442.jpeg",\
"width": "100",\
"height": "100",\
"type": "jpeg",\
"image_group_id": 72250,\
"version": "sm"},\
"norm": {\
"id": "186818",\
"path": "https://yclients.com/uploads/masters/norm/a/aa/aa37b29b7eb322d_20170327201442.jpeg",\
"width": "180",\
"height": "220",\
"type": "jpeg",\
"image_group_id": 72250,\
"version": "norm"},\
"origin": {\
"id": "186819",\
"path": "https://yclients.com/uploads/masters/origin/6/65/654dbeb4ea0bbc3_20170327201442.jpeg",\
"width": "800",\
"height": "600",\
"type": "jpeg",\
"image_group_id": 72250,\
"version": "origin"}}}},\
{\
"id": "34006",\
"api_id": "42",\
"name": "Денис",\
"specialization": "парикмахер",\
"position": [ ],\
"show_rating": "0",\
"rating": "0",\
"votes_count": "0",\
"user_id": 12345,\
"avatar": "https://yclients.com/uploads/masters/sm/20151116091208_4369.jpg",\
"avatar_big": "https://yclients.com/uploads/masters/norm/20151116091208_4369.jpg",\
"comments_count": "0",\
"weight": "9",\
"information": "<span><span>&nbsp;</span></span>",\
"hidden": "0",\
"fired": "0",\
"status": "0",\
"image_group": [ ]},\
{\
"id": "13616",\
"name": "Александр",\
"specialization": "парикмахер",\
"position": [ ],\
"show_rating": "0",\
"rating": "4.76921",\
"votes_count": "0",\
"user_id": 12345,\
"avatar": "https://yclients.com/uploads/masters/sm/20141112123913_5162.jpg",\
"avatar_big": "https://yclients.com/uploads/masters/norm/20141112123913_5162.jpg",\
"comments_count": "26",\
"weight": "8",\
"information": "<span><span><span>&nbsp;</span></span></span>",\
"hidden": "0",\
"fired": "0",\
"status": "0",\
"image_group": [ ]}],
"meta": [ ]}`

## [tag/Sotrudniki/operation/Изменить сотрудника](https://developers.yclients.com/ru/\#tag/Sotrudniki/operation/%D0%98%D0%B7%D0%BC%D0%B5%D0%BD%D0%B8%D1%82%D1%8C%20%D1%81%D0%BE%D1%82%D1%80%D1%83%D0%B4%D0%BD%D0%B8%D0%BA%D0%B0) Изменить сотрудника

put/staff/{company\_id}/{staff\_id}

https://api.yclients.com/api/v1/staff/{company\_id}/{staff\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| staff\_id<br>required | number<br>ID сотрудника |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: \*/\*

|     |     |
| --- | --- |
| name | string<br>Имя сотрудника |
| specialization | string<br>Специализация сотрудника |
| weight | number<br>Вес сотрудника. При выводе сотрудники сортируются по весу, сначала более тяжелые |
| information | string<br>Информация о сотруднике (HTML-формат) |
| api\_id | string<br>Внещний идентификатор сотрудника |
| hidden | number<br>Статус отображения в онлайн-записи, 1 - скрыт, 0 - не скрыт |
| fired | number<br>Статус увольнения сотрудника, 1 - уволен, 0 - не уволен |
| user\_id | number<br>ID привязанного пользователя, 0 - удалить связь с пользователем |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | object<br>Метаданные (содержат количество найденных сотрудников) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 17969,
"api_id": "42",
"name": "Василий",
"specialization": "парикмахер",
"position": {
"id": 1,
"title": "Администратор"},
"show_rating": 0,
"rating": 0,
"votes_count": 0,
"user_id": 12345,
"avatar": "https://yclients.com/uploads/masters/sm/20151018220924_4963.jpg",
"avatar_big": "https://yclients.com/uploads/masters/norm/20151018220924_4963.jpg",
"comments_count": 0,
"weight": 10,
"information": "<span><span><span>&nbsp;</span></span></span>",
"hidden": 0,
"fired": 0,
"status": 0},
"meta": [ ]}`

## [tag/Sotrudniki/operation/Удалить сотрудника](https://developers.yclients.com/ru/\#tag/Sotrudniki/operation/%D0%A3%D0%B4%D0%B0%D0%BB%D0%B8%D1%82%D1%8C%20%D1%81%D0%BE%D1%82%D1%80%D1%83%D0%B4%D0%BD%D0%B8%D0%BA%D0%B0) Удалить сотрудника

delete/staff/{company\_id}/{staff\_id}

https://api.yclients.com/api/v1/staff/{company\_id}/{staff\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| staff\_id<br>required | number<br>ID сотрудника |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**204**
No Content

# [tag/Dolzhnosti](https://developers.yclients.com/ru/\#tag/Dolzhnosti) Должности

Описание методов для работы с должностями сотрудников

## [tag/Dolzhnosti/paths/~1company~1{company_id}~1staff~1positions~1/get](https://developers.yclients.com/ru/\#tag/Dolzhnosti/paths/~1company~1{company_id}~1staff~1positions~1/get) Получить список должностей компании

get/company/{company\_id}/staff/positions/

https://api.yclients.com/api/v1/company/{company\_id}/staff/positions/

Метод позволяет получить список актуальных должностей компании

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Идентификатор компании |

### Responses

**200**
Список должностей компании

##### Response Schema: application/json

|     |     |
| --- | --- |
| data<br>required | Array of objects (StaffPosition) <br>Массив объектов с данными |
| meta<br>required | Array of objects<br>Метаданные (содержит количество найденных должностей) |
| success<br>required | boolean<br>Статус успешности выполнения (true) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"data": [\
{\
"id": 123,\
"title": "Название должности"}],
"meta": [\
{ }],
"success": true}`

## [tag/Dolzhnosti/operation/api.location.positions.create_quick](https://developers.yclients.com/ru/\#tag/Dolzhnosti/operation/api.location.positions.create_quick) Быстрое создание должности

post/company/{company\_id}/positions/quick/

https://api.yclients.com/api/v1/company/{company\_id}/positions/quick/

Создает новую должность в филиале; должность создается как сетевая сущность и одновременно привязывается к филиалу, в которой запрошено ее создание.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| title<br>required | string<br>Название должности. |

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object (Объект модели "Должность") <br>Данные существующей должности в сети. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Request samples

- Payload

Content type

application/json

Copy

`{
"title": "Должность"}`

### Response samples

- 201
- 401
- 403
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 123,
"chain_id": 123,
"title": "Должность",
"description": "Описание должности",
"services_binding_type": 0,
"rules_required_fields": [\
"employee_name",\
"surname",\
"patronymic",\
"date_admission",\
"date_registration_end",\
"phone_number",\
"citizenship",\
"sex",\
"passport_data",\
"inn",\
"number_insurance_certificates"],
"only_chain_appointment": false},
"meta": { }}`

# [tag/Klienty](https://developers.yclients.com/ru/\#tag/Klienty) Клиенты

Для работы с клиентами

## [section/Kollekciya-klientov](https://developers.yclients.com/ru/\#section/Kollekciya-klientov) Коллекция клиентов

- Параметр
  - company\_id (required, number, `1`) \- ID компании

## [tag/Klienty/operation/Получить список клиентов](https://developers.yclients.com/ru/\#tag/Klienty/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%BE%D0%BA%20%D0%BA%D0%BB%D0%B8%D0%B5%D0%BD%D1%82%D0%BE%D0%B2) Получить список клиентов

post/company/{company\_id}/clients/search

https://api.yclients.com/api/v1/company/{company\_id}/clients/search

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| page | number<br>Номер страница |
| page\_size | number<br>Количество выводимых строк на странице. Максимум 200\. (По умолчанию 25) |
| fields | Array of strings<br>Поля, которые нужно вернуть в ответе |
| order\_by | string<br>Enum:"id""name""phone""email""discount""first\_visit\_date""last\_visit\_date""sold\_amount""visits\_count"<br>По какому полю сортировать |
| order\_by\_direction | string<br>Enum:"ASC""DESC"<br>Как сортировать (по возрастанию / по убыванию) |
| operation | string<br>Enum:"AND""OR"<br>Тип операции |
| filters | Array of objects<br>Фильтры для поиска по клиентам |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | object<br>Метаданные (содержит количество найденных клиентов) |

**400**
Bad Request

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (false) |
| data | string<br>Содержит null |
| meta | object<br>Метаданные (содержит сообщение об ошибке) |

**402**
Payment Required

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (false) |
| data | string<br>Содержит null |
| meta | object<br>Метаданные (содержит сообение об ошибке) |

**404**
Когда указан филиал не в виде целого числа

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (false) |
| meta | object<br>Метаданные (содержит сообщение об ошибке) |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"page": 1,
"page_size": 3,
"fields": [\
"id",\
"name"],
"order_by": "name",
"order_by_direction": "desc",
"operation": "AND",
"filters": [\
{\
"type": "id",\
"state": {\
"value": [\
1,\
2,\
3]}},\
{\
"type": "sold_amount",\
"state": {\
"from": 0,\
"to": 100.77}},\
{\
"type": "quick_search",\
"state": {\
"value": "Иван"}},\
{\
"type": "importance",\
"state": {\
"value": [\
0,\
1,\
2,\
3]}},\
{\
"type": "has_mobile_app",\
"state": {\
"value": true}},\
{\
"type": "category",\
"state": {\
"value": [\
1,\
7]}},\
{\
"type": "has_passteam_card",\
"state": {\
"value": true}},\
{\
"type": "passteam_card_ids",\
"state": {\
"value": [\
"111122223333aaaabbbbcccc"]}},\
{\
"type": "birthday",\
"state": {\
"from": "2000-01-01",\
"to": "2000-01-01"}},\
{\
"type": "gender",\
"state": {\
"value": [\
0,\
1,\
2]}},\
{\
"type": "record",\
"state": {\
"staff": {\
"value": [\
1,\
2]},\
"service": {\
"value": [\
2,\
3]},\
"service_category": {\
"value": [\
4,\
5]},\
"status": {\
"value": [\
1]},\
"created": {\
"from": "2020-01-01",\
"to": "2020-05-01"},\
"records_count": {\
"from": 1,\
"to": 99999},\
"sold_amount": {\
"from": 1.001,\
"to": 99999.09}}},\
{\
"type": "client",\
"state": {\
"id": {\
"value": [\
1,\
2,\
3]},\
"birthday": {\
"from": "2000-01-01",\
"to": "2000-03-01"}}},\
{\
"type": "sale",\
"state": {\
"abonement_balance": {\
"from": 2,\
"to": 3}}}]}`

### Response samples

- 200
- 400
- 402
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"name": "Петров",\
"id": 2},\
{\
"name": "Сидоров",\
"id": 3},\
{\
"name": "Иванов",\
"id": 1}],
"meta": {
"total_count": 908}}`

## [tag/Klienty/operation/Устаревшее. Получить список клиентов](https://developers.yclients.com/ru/\#tag/Klienty/operation/%D0%A3%D1%81%D1%82%D0%B0%D1%80%D0%B5%D0%B2%D1%88%D0%B5%D0%B5.%20%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%BE%D0%BA%20%D0%BA%D0%BB%D0%B8%D0%B5%D0%BD%D1%82%D0%BE%D0%B2) Устаревшее. Получить список клиентов Deprecated

get/clients/{company\_id}

https://api.yclients.com/api/v1/clients/{company\_id}

- Параметр
  - company\_id (required, number, `1`) \- ID компании
  - page (number, `1`) \- Номер страницы
  - count (number, `20`) \- Количество клиентов на странице

#### Фильтрация клиентов

- fullname:Joh (optional, string) - Имя (часть имени) для фильтрации клиентов
- phone:7916 (optional, string) - Телефон (часть номера) для фильтрации клиентов
- email:test@ (optional, string) - Email (часть) для фильтрации клиентов
- card:5663rt (optional, string) - Card (часть) для фильтрации клиентов по номеру карты лояльности
- paid\_min:100 (optional, number) - Минимально оплачено в кассу, для фильтрации клиентов по сумме оплат
- paid\_max:0 (optional, number) - Максимально оплачено в кассу, для фильтрации клиентов по сумме оплат
- paid\_max:0 (optional, number) - Максимально оплачено в кассу, для фильтрации клиентов по сумме оплат
- id:66 (optional, number) - ID одного клиента для фильтрации клиентов
- id\[\]: 66 (optional, array) - ID нескольких клиентов для фильтрации
- changed\_after: '2000-01-01T00:00:00' (optional, string) - Фильтрация клиентов, измененных/созданных начиная с конкретной даты и времени
- changed\_before: '2020-12-31T23:59:59' (optional, string) - Фильтрация клиентов, измененных/созданных до конкретной даты и времени

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### query Parameters

|     |     |
| --- | --- |
| fullname | string<br>Example:fullname=Joh<br>Имя (часть имени) для фильтрации клиентов |
| phone | string<br>Example:phone=7916<br>Телефон (часть номера) для фильтрации клиентов |
| email | string<br>Example:email=test@<br>Email (часть) для фильтрации клиентов |
| paid\_min | number<br>Example:paid\_min=1<br>Минимально оплачено в кассу, для фильтрации клиентов по сумме оплат |
| paid\_max | number<br>Example:paid\_max=1<br>Максимально оплачено в кассу, для фильтрации клиентов по сумме оплат |
| page | number<br>Example:page=1<br>Номер страницы |
| count | number<br>Example:count=20<br>Количество клиентов на странице |
| id | number<br>Example:id=66<br>ID одного или нескольких клиентов для фильтрации клиентов |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | object<br>Метаданные (содержит номер страницы и количество клиентов на странице) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 66,\
"name": "Клиент",\
"phone": 79112345678,\
"email": "asdfgh@g.com",\
"categories": [\
{\
"id": 3,\
"title": "Черный список",\
"color": "#0f0f0f"},\
{\
"id": 4,\
"title": "VIP",\
"color": "#e8d313"}],\
"sex_id": 0,\
"sex": "Неизвестно",\
"discount": 10,\
"importance_id": 3,\
"importance": "Золото",\
"card": "123456789",\
"birth_date": "2010-01-01",\
"comment": "тест",\
"sms_check": 1,\
"sms_not": 0,\
"spent": 71842,\
"balance": 0,\
"visits": 34,\
"last_change_date": "2020-02-01T12:00:00+0400",\
"custom_fields": [ ]},\
{\
"id": 16,\
"name": "Юрий",\
"phone": 79112345679,\
"email": "",\
"categories": [ ],\
"sex_id": 0,\
"sex": "Неизвестно",\
"discount": 0,\
"importance_id": 0,\
"importance": "Без класса важности",\
"card": "",\
"birth_date": 0,\
"comment": "",\
"sms_check": 0,\
"sms_not": 0,\
"spent": 0,\
"balance": 0,\
"visits": 3,\
"last_change_date": "2020-04-01T12:00:00+0400",\
"custom_fields": [ ]}],
"meta": {
"page": 1,
"total_count": 8}}`

## [tag/Klienty/operation/Добавить клиента](https://developers.yclients.com/ru/\#tag/Klienty/operation/%D0%94%D0%BE%D0%B1%D0%B0%D0%B2%D0%B8%D1%82%D1%8C%20%D0%BA%D0%BB%D0%B8%D0%B5%D0%BD%D1%82%D0%B0) Добавить клиента

post/clients/{company\_id}

https://api.yclients.com/api/v1/clients/{company\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: \*/\*

|     |     |
| --- | --- |
| name<br>required | string<br>Имя клиента |
| surname | string<br>Фамилия клиента |
| patronymic | string<br>Отчество клиента |
| phone<br>required | string<br>Телефон клиента |
| email | string<br>Email клиента |
| sex\_id | number<br>Пол клиента (1 - мужской, 2 - женский, 0 - не известен) |
| importance\_id | number<br>Класс важности клиента (0 - нет, 1 - бронза, 2 - серебро, 3 - золото) |
| discount | number<br>Скидка клиента |
| card | string<br>Номер карты клиента |
| birth\_date | string<br>Дата рождения клиента в формате yyyy-mm-dd |
| comment | string<br>Комментарий |
| spent | number<br>Сколько потратил средств в компании на момент добавления |
| balance | number<br>Баланс клиента |
| sms\_check | number<br>1 - Поздравлять с Днем Рождения по SMS, 0 - не поздравлять |
| sms\_not | number<br>1 - Исключить клиента из SMS рассылок, 0 - не исключать |
| categories | object<br>Массив идентификаторов категорий клиента |
| custom\_fields | object<br>Массив дополнительных полей клиента в виде пар "api-key": "value" |

### Responses

**201**
Created

### Response samples

- 201

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 1121412,
"name": "Василий",
"surname": "Сонов",
"patronymic": "Васильевич",
"phone": 79211234567,
"email": "123456789@gmail.com",
"categories": [ ],
"sex": "Мужской",
"sex_id": 1,
"discount": 15,
"importance_id": 1,
"importance": "Бронза",
"card": "555888666",
"birth_date": "2010-01-01",
"comment": "кидает понты",
"sms_check": 0,
"sms_not": 0,
"spent": 1000,
"balance": -1200,
"visits": 0,
"last_change_date": "2020-05-01T12:00:00+0400",
"custom_fields": {
"key-1": "value-1"}},
"meta": [ ]}`

## [tag/Klienty/operation/Массовое добавление клиентов](https://developers.yclients.com/ru/\#tag/Klienty/operation/%D0%9C%D0%B0%D1%81%D1%81%D0%BE%D0%B2%D0%BE%D0%B5%20%D0%B4%D0%BE%D0%B1%D0%B0%D0%B2%D0%BB%D0%B5%D0%BD%D0%B8%D0%B5%20%D0%BA%D0%BB%D0%B8%D0%B5%D0%BD%D1%82%D0%BE%D0%B2) Массовое добавление клиентов

post/clients/{company\_id}/bulk

https://api.yclients.com/api/v1/clients/{company\_id}/bulk

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: \*/\*

|     |     |
| --- | --- |
| name<br>required | string<br>Имя клиента |
| surname | string<br>Фамилия клиента |
| patronymic | string<br>Отчество клиента |
| phone<br>required | string<br>Телефон клиента |
| email | string<br>Email клиента |
| sex\_id | number<br>Пол клиента (1 - мужской, 2 - женский, 0 - не известен) |
| importance\_id | number<br>Класс важности клиента (0 - нет, 1 - бронза, 2 - серебро, 3 - золото) |
| discount | number<br>Скидка клиента |
| card | string<br>Номер карты клиента |
| birth\_date | string<br>Дата рождения клиента в формате yyyy-mm-dd |
| comment | string<br>Комментарий |
| spent | number<br>Сколько потратил средств в компании на момент добавления |
| balance | number<br>Баланс клиента |
| sms\_check | number<br>1 - Поздравлять с Днем Рождения по SMS, 0 - не поздравлять |
| sms\_not | number<br>1 - Исключить клиента из SMS рассылок, 0 - не исключать |
| categories | object<br>Массив идентификаторов категорий клиента |

### Responses

**200**
OK

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"created": [\
{\
"id": 19153889,\
"name": "Василий",\
"surname": "Сонов",\
"patronymic": "Васильевич",\
"phone": 79213237567,\
"email": "123456789@gmail.com",\
"card": "555888666",\
"birth_date": "2010-01-01",\
"comment": "кидает понты",\
"discount": 15,\
"visits": 0,\
"sex_id": 1,\
"sex": "Мужской",\
"sms_check": 0,\
"sms_bot": 0,\
"spent": 1000,\
"paid": 0,\
"balance": -1200,\
"importance_id": 1,\
"importance": "Бронза",\
"categories": [\
{\
"id": 101,\
"title": "Лояльный",\
"color": "#bfd4f2"},\
{\
"id": 102,\
"title": "Постоянный",\
"color": "#009800"}],\
"last_change_date": "2020-09-08T13:33:39+0400",\
"custom_fields": [ ]}],
"errors": [\
{\
"phone": 79213237567,\
"name": "Василий СОНов",\
"error": "Клиент с указанным телефоном уже существует в базе"},\
{\
"phone": 721828834101,\
"error": "Не указано имя клиента"},\
{\
"phone": 123,\
"name": "Дмитрий Дмитрев",\
"error": "Телефон должен содержать от 9 до 15 цифр"},\
{\
"name": "Сергей Сергеев",\
"error": "Номер телефона клиента не может быть пустым"}]},
"meta": [ ]}`

## [tag/Klienty/operation/Пример запроса на получение списка файлов клиента](https://developers.yclients.com/ru/\#tag/Klienty/operation/%D0%9F%D1%80%D0%B8%D0%BC%D0%B5%D1%80%20%D0%B7%D0%B0%D0%BF%D1%80%D0%BE%D1%81%D0%B0%20%D0%BD%D0%B0%20%D0%BF%D0%BE%D0%BB%D1%83%D1%87%D0%B5%D0%BD%D0%B8%D0%B5%20%D1%81%D0%BF%D0%B8%D1%81%D0%BA%D0%B0%20%D1%84%D0%B0%D0%B9%D0%BB%D0%BE%D0%B2%20%D0%BA%D0%BB%D0%B8%D0%B5%D0%BD%D1%82%D0%B0) Пример запроса на получение списка файлов клиента

get/company/{company\_id}/clients/files/{client\_id}

https://api.yclients.com/api/v1/company/{company\_id}/clients/files/{client\_id}

Список загруженных **файлов клиента** можно получить, сделав запрос с указанием идентификатора филиала и идентификатора клиента, для которого необходимо получить список.
Идентификатор клиента можно получить из коллекции клиентов.

Список представляет собой массив [файлов клиента](https://developers.yclients.com/ru/#client-file).

**Файл клиента** имеет следующую структуру:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | Идентификатор файла |
| client\_id | number | Идентификатор клиента |
| name | string | Имя файла с расширением |
| description | string | Описание файла |
| extension | string | Расширение имени файла |
| mime | string | MIME-тип файла |
| link | string | Ссылка на скачивание файла |
| date\_create | string | Дата загрузки файла в формате ISO8601 |
| size | string | Форматированная строка размера файла |
| user\_name | string | Имя пользователя, загрузившего файл |
| user\_avatar | string | Аватар пользователя, загрузившего файл |
| can\_edit | boolean | Есть ли право изменять и удалять файл? true - право есть, false - права нет |

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| client\_id<br>required | number<br>ID клиента |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | object<br>Метаданные (содержит количество файлов) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 123,\
"client_id": 123456,\
"name": "test.txt",\
"description": "",\
"date_create": "2020-01-01T12:00:00+0400",\
"extension": "txt",\
"mime": "text/plain",\
"link": "/client_files/download/456/123/",\
"user_name": "Виктор Ситников",\
"user_avatar": "/images/no-master.png",\
"size": "9 B",\
"can_edit": false},\
{\
"id": 789,\
"client_id": 123456,\
"name": "фотография.jpg",\
"description": "",\
"date_create": "2020-01-30T12:30:00+0400",\
"extension": "jpg",\
"mime": "image/jpeg",\
"link": "/client_files/download/456/789/",\
"user_name": "Виктор Ситников",\
"user_avatar": "/images/no-master.png",\
"size": "96.65 KB",\
"can_edit": true}],
"meta": {
"count": 2}}`

## [tag/Klienty/operation/Пример запроса на удаление](https://developers.yclients.com/ru/\#tag/Klienty/operation/%D0%9F%D1%80%D0%B8%D0%BC%D0%B5%D1%80%20%D0%B7%D0%B0%D0%BF%D1%80%D0%BE%D1%81%D0%B0%20%D0%BD%D0%B0%20%D1%83%D0%B4%D0%B0%D0%BB%D0%B5%D0%BD%D0%B8%D0%B5) Пример запроса на удаление

delete/company/{company\_id}/clients/files/{client\_id}/{file\_id}

https://api.yclients.com/api/v1/company/{company\_id}/clients/files/{client\_id}/{file\_id}

##### Authorizations:

_bearer_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| client\_id<br>required | number<br>ID клиента |
| file\_id<br>required | number<br>ID файла |

##### header Parameters

|     |     |
| --- | --- |
| Accept | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |

### Responses

**202**
Accepted

### Response samples

- 202

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"meta": {
"message": "Accepted"}}`

## [tag/Klienty/operation/api.location.clients.visits.search](https://developers.yclients.com/ru/\#tag/Klienty/operation/api.location.clients.visits.search) Поиск по истории посещений клиента

post/company/{company\_id}/clients/visits/search

https://api.yclients.com/api/v1/company/{company\_id}/clients/visits/search

Выводит записи из истории посещений клиента по его идентификатору или номеру телефона. В ответ попадают записи и
продажи товаров, объединенные по визитам, отфильтрованные по статусу посещения и статусу оплаты визита. Результат
сортируется по дате и разбивается на страницы по 25 элементов (или более, если дата последней записи совпадает с
датой следующей записи). Идентификация клиента происходит по входному параметру `client_id` либо по `client_phone`.
Остальные параметры могут иметь пустое значение.

Для получения данных на следующей странице необходимо выполнить запрос с параметрами `from` и `to`,
полученными в результате текущего запроса в поле `meta`.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| client\_id<br>required | number or null<br>Идентификатор клиента. |
| client\_phone<br>required | string or null<br>Номер телефона клиента. |
| from<br>required | string or null<date><br>Дата начала периода. |
| to<br>required | string or null<date><br>Дата конца периода. |
| payment\_statuses<br>required | Array of strings<br>ItemsEnum:"not\_paid""paid\_not\_full""paid\_full""paid\_over"<br>Статус оплаты визита:<br>`not_paid` \- визит неоплачен, никаких оплат по визиту не проходило;<br>`paid_not_full` \- визит оплачен частично;<br>`paid_full` \- визит оплачен полностью, переплаты нет;<br>`paid_over` \- по визиту есть переплата.<br>Если фильтр по статусу оплаты не требуется, то необходимо передать пустой массив `[]`. |
| attendance<br>required | number or null<br>Enum:-1012<br>Статус посещения:<br>`-1`: \- клиент не пришёл;<br>`0`: \- ожидание клиента;<br>`1`: \- клиент пришёл;<br>`2`: \- клиент подтвердил запись. |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object (Объект модели "История посещений клиента") <br>Данные по визитам клиента, включая записи и продажи товаров. |
| meta | object (Объект информации о постраничной навигации, основанной на дате.) <br>Информация о постраничной навигации, содержащая данные о текущей, следующей и предыдущей страницах.<br>Данные отсортированы и разбиты на страницы по датам в убывающем порядке. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"client_id": 123,
"client_phone": "79998887766",
"from": "2022-01-31",
"to": "2022-02-01",
"payment_statuses": [\
"not_paid"],
"attendance": -1}`

### Response samples

- 200
- 401
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"goods_transactions": [\
{\
"id": 123,\
"comment": "Комментарий к продаже товара",\
"date": "2021-01-31 12:34:56",\
"visit_id": 0,\
"record_id": 0,\
"goods": [\
{\
"id": 123,\
"title": "Мой товар",\
"amount": -1,\
"unit": "шт.",\
"cost_per_unit": 1000,\
"first_cost": -1000,\
"discount_percent": 0,\
"cost_to_pay": 1000,\
"paid_sum": 1000,\
"payment_status": "paid_full"}],\
"staff": {\
"id": 123,\
"name": "Иван Иванов",\
"company_id": 123,\
"specialization": "Мастер",\
"avatar": "https://yclients.com/images/no-master-sm.png",\
"avatar_big": "https://yclients.com/images/no-master.png",\
"position": {\
"id": 123,\
"title": "Сотрудник"}},\
"company": {\
"id": 123,\
"title": "Мой филиал"}}],
"records": [\
{\
"id": 123,\
"comment": "Комментарий к записи",\
"date": "2021-01-31 12:34:56",\
"visit_id": 123,\
"attendance": 1,\
"services": [\
{\
"id": 123,\
"title": "Моя услуга",\
"first_cost": 1000,\
"discount_percent": 0,\
"cost_to_pay": 1000,\
"paid_sum": 1000,\
"payment_status": "paid_full",\
"consumables": [\
{\
"title": "Мой расходник",\
"amount": 1,\
"cost_per_unit": 1000,\
"unit": "шт."}]}],\
"staff": {\
"id": 123,\
"name": "Иван Иванов",\
"company_id": 123,\
"specialization": "Мастер",\
"avatar": "https://yclients.com/images/no-master-sm.png",\
"avatar_big": "https://yclients.com/images/no-master.png",\
"position": {\
"id": 123,\
"title": "Сотрудник"}},\
"company": {\
"id": 123,\
"title": "Мой филиал"},\
"tips": {\
"has_tips": false,\
"sum": null},\
"comer": {\
"id": 123,\
"title": "Иванов Иван",\
"slug": "person"}}]},
"meta": {
"dateCursor": {
"previous": {
"to": "2022-01-31",
"from": "2022-01-20",
"count": 7},
"current": {
"to": "2022-01-19",
"from": "2022-01-15",
"count": 25},
"next": {
"to": "2022-01-14",
"from": "2022-01-05",
"count": 25}}}}`

## [tag/Klienty/operation/Получить клиента](https://developers.yclients.com/ru/\#tag/Klienty/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D0%BA%D0%BB%D0%B8%D0%B5%D0%BD%D1%82%D0%B0) Получить клиента

get/client/{company\_id}/{id}

https://api.yclients.com/api/v1/client/{company\_id}/{id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| id<br>required | number<br>ID клиента |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 16,
"name": "Василий",
"surname": "Сонов",
"patronymic": "Васильевич",
"phone": 79112345679,
"email": "",
"categories": [ ],
"sex": "Неизвестно",
"discount": 0,
"importance": "Без класса важности",
"card": "",
"birth_date": 0,
"comment": "",
"sms_check": 0,
"sms_not": 0,
"spent": 0,
"balance": 0,
"visits": 3,
"last_change_date": "2020-03-01T12:00:00+0400",
"custom_fields": [ ]},
"meta": [ ]}`

## [tag/Klienty/operation/Редактировать клиента](https://developers.yclients.com/ru/\#tag/Klienty/operation/%D0%A0%D0%B5%D0%B4%D0%B0%D0%BA%D1%82%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%D1%82%D1%8C%20%D0%BA%D0%BB%D0%B8%D0%B5%D0%BD%D1%82%D0%B0) Редактировать клиента

put/client/{company\_id}/{id}

https://api.yclients.com/api/v1/client/{company\_id}/{id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| id<br>required | number<br>ID клиента |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: \*/\*

|     |     |
| --- | --- |
| name<br>required | string<br>Имя клиента |
| surname | string<br>Фамилия клиента |
| patronymic | string<br>Отчество клиента |
| phone<br>required | string<br>Телефон клиента |
| email | string<br>Email клиента |
| sex\_id | number<br>Пол клиента (1 - мужской, 2 - женский, 0 - не известен) |
| importance\_id | number<br>Класс важности клиента (0 - нет, 1 - бронза, 2 - серебро, 3 - золото) |
| discount | number<br>Скидка клиента |
| card | string<br>Номер карты клиента |
| birth\_date | string<br>Дата рождения клиента в формате yyyy-mm-dd |
| comment | string<br>Комментарий |
| spent | number<br>Сколько потратил средств в компании на момент добавления |
| balance | number<br>Баланс клиента |
| sms\_check | number<br>1 - Поздравлять с Днем Рождения по SMS, 0 - не поздравлять |
| sms\_not | number<br>1 - Исключить клиента из SMS рассылок, 0 - не исключать |
| labels | object<br>Массив идентификаторов категорий клиента |
| custom\_fields | object<br>Массив дополнительных полей клиента в виде пар "api-key": "value" |

### Responses

**200**
OK

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 1121412,
"name": "Василий",
"surname": "Сонов",
"patronymic": "Васильевич",
"phone": 79211234567,
"email": "123456789@gmail.com",
"categories": [ ],
"sex": "Мужской",
"sex_id": 1,
"discount": 15,
"importance_id": 1,
"importance": "Бронза",
"card": "555888666",
"birth_date": "2010-01-01",
"comment": "кидает понты",
"sms_check": 0,
"sms_not": 0,
"spent": 1000,
"balance": -1200,
"visits": 0,
"last_change_date": "2020-06-01T12:00:00+0400",
"custom_fields": {
"key-1": "value-1"}},
"meta": [ ]}`

## [tag/Klienty/operation/Удалить клиента](https://developers.yclients.com/ru/\#tag/Klienty/operation/%D0%A3%D0%B4%D0%B0%D0%BB%D0%B8%D1%82%D1%8C%20%D0%BA%D0%BB%D0%B8%D0%B5%D0%BD%D1%82%D0%B0) Удалить клиента

delete/client/{company\_id}/{id}

https://api.yclients.com/api/v1/client/{company\_id}/{id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| id<br>required | number<br>ID клиента |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**204**
No Content

## [tag/Klienty/operation/api.location.clients.comments.list](https://developers.yclients.com/ru/\#tag/Klienty/operation/api.location.clients.comments.list) Получение списка комментариев к клиенту

get/company/{company\_id}/clients/{client\_id}/comments

https://api.yclients.com/api/v1/company/{company\_id}/clients/{client\_id}/comments

Возвращает список комментариев к клиенту, а также историю загрузки файлов в карточку клиента в виде комментариев.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |
| client\_id<br>required | number<br>Example:123<br>Идентификатор клиента филиала. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | Array of objects (Объект модели "Комментарий к клиенту") |
| meta | object (Объект дополнительной информации о запросе с кол-вом найденных результатов) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

### Response samples

- 200
- 401
- 403
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 123,\
"create_date": "2023-01-01 12:12:12",\
"update_date": "2023-01-01 12:12:12",\
"type": "default",\
"text": "Комментарий к клиенту",\
"files": [ ],\
"user": {\
"id": 123,\
"name": "Иван Иванов",\
"avatar": "https://api.yclients.com/images/avatar.png"}}],
"meta": {
"count": 10}}`

## [tag/Klienty/operation/api.location.clients.comments.create](https://developers.yclients.com/ru/\#tag/Klienty/operation/api.location.clients.comments.create) Добавление комментария к клиенту

post/company/{company\_id}/clients/{client\_id}/comments

https://api.yclients.com/api/v1/company/{company\_id}/clients/{client\_id}/comments

Создает новый текстовый комментарий к клиенту.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |
| client\_id<br>required | number<br>Example:123<br>Идентификатор клиента филиала. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| text<br>required | string<br>Текст комментария к клиенту. |

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object (Объект модели "Комментарий к клиенту") <br>Данные по комментарию к клиенту. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Request samples

- Payload

Content type

application/json

Copy

`{
"text": "Комментарий к клиенту"}`

### Response samples

- 201
- 401
- 403
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 123,
"create_date": "2023-01-01 12:12:12",
"update_date": "2023-01-01 12:12:12",
"type": "default",
"text": "Комментарий к клиенту",
"files": [ ],
"user": {
"id": 123,
"name": "Иван Иванов",
"avatar": "https://api.yclients.com/images/avatar.png"}},
"meta": { }}`

## [tag/Klienty/operation/api.location.clients.comments.delete](https://developers.yclients.com/ru/\#tag/Klienty/operation/api.location.clients.comments.delete) Удаление комментария к клиенту

delete/company/{company\_id}/clients/{client\_id}/comments/{comment\_id}

https://api.yclients.com/api/v1/company/{company\_id}/clients/{client\_id}/comments/{comment\_id}

Удаляет комментарий к клиенту; не удаляет загруженные в карточку клиента файлы, загрузка которых породила создание комментария.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |
| client\_id<br>required | number<br>Example:123<br>Идентификатор клиента филиала. |
| comment\_id<br>required | number<br>Example:123<br>Идентификатор комментария клиента. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

### Responses

**204**
No Content

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

### Response samples

- 204
- 401
- 403
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": null,
"meta": { }}`

# [tag/Setevye-klienty](https://developers.yclients.com/ru/\#tag/Setevye-klienty) Сетевые клиенты

Для работы с клиентами

## [tag/Setevye-klienty/operation/Получить сетевого клиента по номеру телефона.](https://developers.yclients.com/ru/\#tag/Setevye-klienty/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%B5%D1%82%D0%B5%D0%B2%D0%BE%D0%B3%D0%BE%20%D0%BA%D0%BB%D0%B8%D0%B5%D0%BD%D1%82%D0%B0%20%D0%BF%D0%BE%20%D0%BD%D0%BE%D0%BC%D0%B5%D1%80%D1%83%20%D1%82%D0%B5%D0%BB%D0%B5%D1%84%D0%BE%D0%BD%D0%B0.) Получить сетевого клиента по номеру телефона.

get/group/{group\_id}/clients/

https://api.yclients.com/api/v1/group/{group\_id}/clients/

- Параметр
  - group\_id (required, number, `43877`) \- Id сети салонов

#### Фильтрация клиентов

- phone:'70001234567' (optional, string) - Телефон для фильтрации клиентов

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| group\_id<br>required | number<br>ID сети салонов |

##### query Parameters

|     |     |
| --- | --- |
| phone<br>required | string<br>Example:phone='79264037640'<br>Телефон для фильтрации клиентов, обязательный параметр |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token.User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения |
| data | string<br>Содержит null |
| meta | object<br>Объект с сообщением об ошибке |

### Response samples

- 200
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"salon_group_id": 312,
"phone": "70001234567",
"clients": [\
{\
"id": 4240880,\
"company_id": 4564,\
"name": "lx",\
"email": "client@example.com"},\
{\
"id": 4243272,\
"company_id": 24697,\
"name": "lx",\
"email": "client@example.com"}]},
"meta": [ ]}`

# [tag/Zapisi](https://developers.yclients.com/ru/\#tag/Zapisi) Записи

## [tag/Zapisi/operation/Получить список записей](https://developers.yclients.com/ru/\#tag/Zapisi/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%BE%D0%BA%20%D0%B7%D0%B0%D0%BF%D0%B8%D1%81%D0%B5%D0%B9) Получить список записей

get/records/{company\_id}

https://api.yclients.com/api/v1/records/{company\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### query Parameters

|     |     |
| --- | --- |
| page | number<br>Example:page=1<br>Номер страницы |
| count | number<br>Example:count=50<br>Количество записей на странице |
| staff\_id | number<br>Example:staff\_id=7572<br>ID сотрудника, если нужно только записи к конкретному сотруднику |
| client\_id | number<br>Example:client\_id=572<br>ID клиента. Если нужны записи к конкретному клиенту |
| created\_user\_id | number<br>Example:created\_user\_id=7572<br>ID пользователя создавшего запись. Если нужны записи созданные конкретным пользователем |
| start\_date | date<br>Example:start\_date=2019-01-01<br>Дата сеанса начина с (фильтр по дате сеанса). Если нужны записи на сеанс начиная с конкретной даты |
| end\_date | date<br>Example:end\_date=2019-05-01<br>Дата сеанса по. Если нужны записи на сеанс до конкретной даты |
| c\_start\_date | date<br>Example:c\_start\_date=2019-01-01<br>Дата создания записи начиная с(фильтр по дате создания записи). Если нужны записи созданные начиная с конкретной даты |
| c\_end\_date | date<br>Example:c\_end\_date=2019-05-01<br>Дата создания записи по(фильтр по дате создания записи). |
| changed\_after | date<br>Example:changed\_after=2019-01-01<br>Дата изменения/создания записи. Если нужны записи созданные/измененные начиная с конкретной даты и времени |
| changed\_before | date<br>Example:changed\_before=2019-05-01<br>Дата изменения/создания записи. Если нужны записи созданные/измененные до конкретной даты и времени |
| include\_consumables | number<br>Example:include\_consumables=0<br>Флаг для включения в ответ списка расходников по записям |
| include\_finance\_transactions | number<br>Example:include\_finance\_transactions=0<br>флаг для включения в ответ финансовых транзакций по записям |
| with\_deleted | boolean<br>Включить в выдачу удаленные записи (with\_deleted=1 вернет и удаленные записи) |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | object<br>Метаданные (содержит номер страницы и количество записей на странице) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 2,\
"company_id": 4564,\
"staff_id": 9,\
"services": [\
{\
"id": 1,\
"title": "Наращивание волос",\
"cost": 100,\
"cost_to_pay": 100,\
"manual_cost": 100,\
"cost_per_unit": 100,\
"discount": 0,\
"first_cost": 100,\
"amount": 1}],\
"goods_transactions": [ ],\
"staff": {\
"id": 9,\
"name": "Оксана",\
"specialization": "наращивание волос",\
"position": {\
"id": 1,\
"title": "Администратор"},\
"avatar": "http://yclients.com/images/no-master-sm.png",\
"avatar_big": "http://yclients.com/images/no-master.png",\
"rating": 0,\
"votes_count": 0},\
"client": null,\
"comer": null,\
"clients_count": 1,\
"date": "2019-01-16 16:00:00",\
"datetime": "2019-01-16T16:00:00+09:00",\
"create_date": "2019-01-16T20:35:11+0900",\
"comment": "не записывать",\
"online": false,\
"visit_attendance": 0,\
"attendance": 0,\
"confirmed": 1,\
"seance_length": 3600,\
"length": 3600,\
"sms_before": 0,\
"sms_now": 0,\
"sms_now_text": "",\
"email_now": 0,\
"notified": 0,\
"master_request": 0,\
"api_id": "",\
"from_url": "",\
"review_requested": 0,\
"visit_id": "8262996",\
"created_user_id": 1073232,\
"deleted": false,\
"paid_full": 0,\
"prepaid": false,\
"prepaid_confirmed": false,\
"last_change_date": "2019-01-16T20:35:15+0900",\
"custom_color": "",\
"custom_font_color": "",\
"record_labels": [ ],\
"activity_id": 0,\
"custom_fields": [ ],\
"documents": [\
{\
"id": 8172893,\
"type_id": 7,\
"storage_id": 0,\
"user_id": 746310,\
"company_id": 4564,\
"number": 4163,\
"comment": "",\
"date_created": "2019-01-16 16:00:00",\
"category_id": 0,\
"visit_id": 3,\
"record_id": 2,\
"type_title": "Визит",\
"is_sale_bill_printed": false}],\
"sms_remain_hours": 5,\
"email_remain_hours": 1,\
"bookform_id": 0,\
"record_from": "",\
"is_mobile": 0,\
"is_sale_bill_printed": false,\
"consumables": [ ],\
"finance_transactions": [ ]},\
{\
"id": 9,\
"company_id": 4564,\
"staff_id": 49,\
"services": [ ],\
"goods_transactions": [ ],\
"staff": {\
"id": 49,\
"name": "Сергей",\
"specialization": "стилист",\
"position": {\
"id": 1,\
"title": "Администратор"},\
"avatar": "http://yclients.com/images/no-master-sm.png",\
"avatar_big": "http://yclients.com/images/no-master.png",\
"rating": 0,\
"votes_count": 0},\
"date": "2019-01-16 16:00:00",\
"datetime": "2019-01-16T16:00:00+09:00",\
"create_date": "2019-01-16T20:35:11+0900",\
"comment": "",\
"online": true,\
"visit_attendance": 1,\
"attendance": 1,\
"confirmed": 1,\
"seance_length": 10800,\
"length": 10800,\
"sms_before": 0,\
"sms_now": 0,\
"sms_now_text": "",\
"email_now": 0,\
"notified": 0,\
"master_request": 1,\
"api_id": "",\
"from_url": "",\
"review_requested": 0,\
"visit_id": "8262996",\
"created_user_id": 1073232,\
"deleted": false,\
"paid_full": 0,\
"prepaid": false,\
"prepaid_confirmed": false,\
"last_change_date": "2017-01-09T20:45:30+0900",\
"custom_color": "f44336",\
"custom_font_color": "#ffffff",\
"record_labels": [\
{\
"id": "67345",\
"title": "Сотрудник не важен",\
"color": "#009800",\
"icon": "unlock",\
"font_color": "#ffffff"},\
{\
"id": "104474",\
"title": "важная категория",\
"color": "#3b2c54",\
"icon": "odnoklassniki",\
"font_color": "#ffffff"}],\
"activity_id": 0,\
"custom_fields": [ ],\
"documents": [\
{\
"id": 8172893,\
"type_id": 7,\
"storage_id": 0,\
"user_id": 746310,\
"company_id": 4564,\
"number": 4163,\
"comment": "",\
"date_created": "2019-01-16 16:00:00",\
"category_id": 0,\
"visit_id": 3,\
"record_id": 2,\
"type_title": "Визит",\
"is_sale_bill_printed": false}],\
"sms_remain_hours": 5,\
"email_remain_hours": 1,\
"bookform_id": 0,\
"record_from": "",\
"is_mobile": 0,\
"is_sale_bill_printed": false,\
"consumables": [ ],\
"finance_transactions": [ ]}],
"meta": {
"page": 1,
"total_count": 10}}`

## [tag/Zapisi/operation/Создать новую запись](https://developers.yclients.com/ru/\#tag/Zapisi/operation/%D0%A1%D0%BE%D0%B7%D0%B4%D0%B0%D1%82%D1%8C%20%D0%BD%D0%BE%D0%B2%D1%83%D1%8E%20%D0%B7%D0%B0%D0%BF%D0%B8%D1%81%D1%8C) Создать новую запись

post/records/{company\_id}

https://api.yclients.com/api/v1/records/{company\_id}

Для групповых событий
При создании записи в групповом событии параметр activity\_id становится обязательным,
параметры staff\_id, services, datetime, seance\_length становятся необязательными.

Дополнительные поля
При создании дополнительных полей записи(см. раздел "Дополнительные поля") становится возможным передавать собственные значения для полей.
Дополнительные поля уникальны для каждой компании. После создания дополнительных полей, их значения для конкретной записи могут
передаваться в необязательном поле custom\_fields в виде пар ключ-значение где ключ это поле "code" дополнительного поля. Пример:

- Создали дополнительное поле записи с code="my\_custom\_field" type="number", и второе поле code="some\_another\_field" type="list"

- Передали при создании записи еще один атрибут:
custom\_fields: {
"my\_custom\_field": 123,
"some\_another\_field": \["first value", "second value"\]
}

- При получении данной записи методом GET впоследствии, это же значение дополнительных полей вернется в ответе


##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:24699<br>ID компании |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| staff\_id | number<br>Идентификатор сотрудника |
| services | Array of objects<br>Параметры услуг (id, стоимость, скидка) |
| client | object<br>Параметры клиента (телефон, имя, email) |
| save\_if\_busy | boolean<br>Сохранять ли запись если время занято или нерабочее, или выдать ошибку |
| datetime | string<date-time><br>Дата и время записи |
| seance\_length | number<br>Длительность записи в секундах |
| send\_sms | boolean<br>Отправлять ли смс с деталями записи клиенту |
| comment | string<br>Комментарий к записи |
| sms\_remain\_hours | number<br>За сколько часов до визита следует выслать смс напоминание клиенту (0 - если не нужно) |
| email\_remain\_hours | number<br>За сколько часов до визита следует выслать email напоминание клиенту (0 - если не нужно) |
| attendance | number<br>Статус записи (2 - Пользователь подтвердил запись, 1 - Пользователь пришел, услуги оказаны, 0 - ожидание пользователя, -1 - пользователь не пришел на визит) |
| api\_id | string<br>Идентификатор внешней системы |
| custom\_color | string<br>Цвет записи |
| record\_labels | Array of strings<br>Массив идентификаторов категорий записи |
| client\_agreements | object or null<br>Юридические соглашения клиента |
| technical\_break\_duration | number or null\[ 0 .. 3600 \]<br>Технический перерыв. <br>- Строго кратно 300 (5 минутам).<br>- Максимальное значение 3600 (1 час) <br>- Если передан `null` или значение не передано — <br>будет задан согласно настройкам в разделе _Настройки → Журнал записи → Технические перерывы_ при наличии услуг с перерывом |
| custom\_fields | object<br>Дополнительные поля записи |

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | object<br>Метаданные (содержит номер страницы и количество записей на странице) |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"staff_id": 8886,
"services": [\
{\
"id": 331,\
"first_cost": 9000,\
"discount": 50,\
"cost": 4500},\
{\
"id": 333,\
"first_cost": 2000,\
"discount": 10,\
"cost": 1800}],
"client": {
"phone": "79169999900",
"name": "Дмитрий",
"surname": "",
"patronymic": "",
"email": "d@yclients.com"},
"save_if_busy": false,
"datetime": "2019-01-01 17:00:00",
"seance_length": 3600,
"send_sms": true,
"comment": "тестовая запись!",
"sms_remain_hours": 6,
"email_remain_hours": 24,
"attendance": 1,
"api_id": "777",
"custom_color": "f44336",
"record_labels": [\
"67345",\
"104474"],
"custom_fields": {
"my_custom_field": 123,
"some_another_field": [\
"first value",\
"second value"]},
"client_agreements": {
"is_newsletter_allowed": false,
"is_personal_data_processing_allowed": true}}`

### Response samples

- 201

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 2,\
"company_id": 4564,\
"staff_id": 9,\
"services": [\
{\
"id": 1,\
"title": "Наращивание волос",\
"cost": 100,\
"cost_to_pay": 100,\
"manual_cost": 100,\
"cost_per_unit": 100,\
"discount": 0,\
"first_cost": 100,\
"amount": 1}],\
"goods_transactions": [ ],\
"staff": {\
"id": 9,\
"name": "Оксана",\
"specialization": "наращивание волос",\
"position": {\
"id": 1,\
"title": "Администратор"},\
"avatar": "http://yclients.com/images/no-master-sm.png",\
"avatar_big": "http://yclients.com/images/no-master.png",\
"rating": 0,\
"votes_count": 0},\
"date": "2019-01-16 20:35:11",\
"datetime": "2019-01-16T20:35:11+0900",\
"create_date": "2019-01-16T20:35:11+0900",\
"comment": "не записывать",\
"online": false,\
"visit_attendance": 0,\
"attendance": 0,\
"confirmed": 1,\
"seance_length": 3600,\
"length": 3600,\
"sms_before": 0,\
"sms_now": 0,\
"sms_now_text": "",\
"email_now": 0,\
"notified": 0,\
"master_request": 0,\
"api_id": "",\
"from_url": "",\
"review_requested": 0,\
"visit_id": "8262996",\
"created_user_id": 1073232,\
"deleted": false,\
"paid_full": 0,\
"prepaid": false,\
"prepaid_confirmed": false,\
"last_change_date": "2019-01-16T20:35:15+0900",\
"custom_color": "",\
"custom_font_color": "",\
"record_labels": [ ],\
"activity_id": 0,\
"custom_fields": [ ],\
"documents": [\
{\
"id": 8172893,\
"type_id": 7,\
"storage_id": 0,\
"user_id": 746310,\
"company_id": 4564,\
"number": 4163,\
"comment": "",\
"date_created": "2019-01-16 12:00:00",\
"category_id": 0,\
"visit_id": 3,\
"record_id": 2,\
"type_title": "Визит",\
"is_sale_bill_printed": false}],\
"consumables": [ ],\
"finance_transactions": [ ]},\
{\
"id": 9,\
"company_id": 4564,\
"staff_id": 49,\
"services": [ ],\
"goods_transactions": [ ],\
"staff": {\
"id": 49,\
"name": "Сергей",\
"specialization": "стилист",\
"position": {\
"id": 1,\
"title": "Администратор"},\
"avatar": "http://yclients.com/images/no-master-sm.png",\
"avatar_big": "http://yclients.com/images/no-master.png",\
"rating": 0,\
"votes_count": 0},\
"date": "2019-01-16 20:35:11",\
"datetime": "2019-01-16T20:35:11+0900",\
"create_date": "2019-01-16T20:35:11+0900",\
"comment": "",\
"online": true,\
"visit_attendance": 1,\
"attendance": 1,\
"confirmed": 1,\
"seance_length": 10800,\
"length": 10800,\
"sms_before": 0,\
"sms_now": 0,\
"sms_now_text": "",\
"email_now": 0,\
"notified": 0,\
"master_request": 1,\
"api_id": "",\
"from_url": "",\
"review_requested": 0,\
"visit_id": "8262996",\
"created_user_id": 1073232,\
"deleted": false,\
"paid_full": 0,\
"prepaid": false,\
"prepaid_confirmed": false,\
"last_change_date": "2017-01-09T20:45:30+0900",\
"custom_color": "f44336",\
"custom_font_color": "#ffffff",\
"record_labels": [\
{\
"id": "67345",\
"title": "Сотрудник не важен",\
"color": "#009800",\
"icon": "unlock",\
"font_color": "#ffffff"},\
{\
"id": "104474",\
"title": "важная категория",\
"color": "#3b2c54",\
"icon": "odnoklassniki",\
"font_color": "#ffffff"}],\
"activity_id": 0,\
"custom_fields": [ ],\
"documents": [\
{\
"id": 8172893,\
"type_id": 7,\
"storage_id": 0,\
"user_id": 746310,\
"company_id": 4564,\
"number": 4163,\
"comment": "",\
"date_created": "2019-01-16 12:00:00",\
"category_id": 0,\
"visit_id": 3,\
"record_id": 2,\
"type_title": "Визит",\
"is_sale_bill_printed": false}],\
"consumables": [ ],\
"finance_transactions": [ ]}],
"meta": {
"page": 1,
"total_count": 10}}`

## [tag/Zapisi/operation/Получить список записей партнёра](https://developers.yclients.com/ru/\#tag/Zapisi/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%BE%D0%BA%20%D0%B7%D0%B0%D0%BF%D0%B8%D1%81%D0%B5%D0%B9%20%D0%BF%D0%B0%D1%80%D1%82%D0%BD%D1%91%D1%80%D0%B0) Получить список записей партнёра

get/records/partner/

https://api.yclients.com/api/v1/records/partner/

##### Authorizations:

(_bearer__user_)

##### query Parameters

|     |     |
| --- | --- |
| page | number<br>Example:page=1<br>Номер страницы |
| editable\_length | number<br>Example:editable\_length=50<br>Количество записей на странице, максимум 100 |
| salon\_id | number<br>Example:salon\_id=1<br>ID филиала |
| start\_date | string<br>Example:start\_date='17.01.2018'<br>Фильтр по дате визита с |
| end\_date | string<br>Example:end\_date='17.01.2018'<br>Фильтр по дате визита по |
| created\_start\_date | string<br>Example:created\_start\_date='17.01.2018'<br>Фильтр по дате создания записи с |
| created\_end\_date | string<br>Example:created\_end\_date='17.01.2018'<br>Фильтр по дате создания записи по |
| user\_id | number<br>Example:user\_id=1<br>ID пользователя |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 1,\
"date": "2018-11-17 00:00:00",\
"datetime": "2018-11-17T00:00:00+0400",\
"create_date": "2018-11-17T16:08:08+0400",\
"comment": "",\
"deleted": false,\
"attendance": 0,\
"length": 3600,\
"notify_by_sms": 1,\
"notify_by_email": 12,\
"master_requested": true,\
"online": false,\
"api_id": "42",\
"last_change_date": "2018-11-18T16:58:59+0400",\
"prepaid": 0,\
"prepaid_confirmed": 0,\
"activity_id": 0,\
"services": [\
{\
"id": 1,\
"title": "Стрижка бороды",\
"cost": 100,\
"price_min": 500,\
"price_max": 1500,\
"discount": 0,\
"amount": 1}],\
"company": {\
"id": 1,\
"title": "",\
"public_title": "",\
"business_group_id": 1,\
"business_type_id": 1,\
"country_id": 1,\
"city_id": 1,\
"timezone": 3,\
"timezone_name": "Europe/Moscow",\
"address": "",\
"coordinate_lat": 0,\
"coordinate_lon": 0,\
"logo": "http://yclients.com/images/icon.png",\
"zip": 0,\
"phone": "",\
"phones": [ ],\
"site": "",\
"allow_delete_record": true,\
"allow_change_record": true,\
"country": "Россия",\
"city": "Москва"},\
"staff": {\
"id": 1,\
"name": "Иван",\
"company_id": 1,\
"specialization": "Барбер",\
"position": [ ],\
"rating": 0,\
"show_rating": 1,\
"comments_count": 0,\
"votes_count": 0,\
"average_score": 0,\
"avatar": "http://yclients.com/images/no-master-sm.png",\
"prepaid": "forbidden"},\
"client": {\
"id": 1,\
"name": "Иван",\
"surname": "Иванов",\
"patronymic": "Иванович",\
"phone": "+7 999 123-45-67",\
"phone_code": "7",\
"email": "NeIvanov@example.com"},\
"custom_fields": {\
"dop-telephone": "70001234567"}}],
"meta": {
"count": 1}}`

## [tag/Zapisi/operation/Получить запись](https://developers.yclients.com/ru/\#tag/Zapisi/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D0%B7%D0%B0%D0%BF%D0%B8%D1%81%D1%8C) Получить запись

get/record/{company\_id}/{record\_id}

https://api.yclients.com/api/v1/record/{company\_id}/{record\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| record\_id<br>required | number<br>ID записи |

##### query Parameters

|     |     |
| --- | --- |
| include\_consumables | number<br>Example:include\_consumables=0 |
| include\_finance\_transactions | number<br>Example:include\_finance\_transactions=0 |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 2,
"company_id": 4564,
"staff_id": 9,
"services": [\
{\
"id": 1,\
"title": "Наращивание волос",\
"cost": 100,\
"cost_to_pay": 100,\
"manual_cost": 100,\
"cost_per_unit": 100,\
"discount": 0,\
"first_cost": 100,\
"amount": 1}],
"goods_transactions": [ ],
"staff": {
"id": 9,
"name": "Оксана",
"specialization": "наращивание волос",
"position": {
"id": 1,
"title": "Администратор"},
"avatar": "http://yclients.com/images/no-master-sm.png",
"avatar_big": "http://yclients.com/images/no-master.png",
"rating": 0,
"votes_count": 0},
"client": {
"id": 18936825,
"name": "Иванов",
"surname": "Иван",
"patronymic": "Иванович",
"display_name": "Иван Иванович Иванов",
"phone": 70001234567,
"card": "",
"email": "client@example.com",
"success_visits_count": 37,
"fail_visits_count": 3,
"discount": 0,
"is_new": false,
"custom_fields": [ ]},
"comer": null,
"clients_count": 1,
"date": "2019-01-01 12:00:00",
"datetime": "2019-01-01T12:00:00+09:00",
"create_date": "2019-01-17T19:41:44+0900",
"comment": "не записывать",
"visit_attendance": 0,
"attendance": 0,
"confirmed": 1,
"seance_length": 3600,
"length": 3600,
"sms_before": 0,
"sms_now": 0,
"sms_now_text": "",
"email_now": 0,
"notified": 0,
"master_request": 0,
"api_id": "",
"from_url": "",
"review_requested": 0,
"visit_id": "8263004",
"created_user_id": 1073232,
"deleted": false,
"paid_full": 0,
"payment_status": 0,
"prepaid": false,
"prepaid_confirmed": false,
"last_change_date": "2019-01-17T19:44:14+0900",
"custom_color": "f44336",
"custom_font_color": "#ffffff",
"record_labels": [\
{\
"id": "67345",\
"title": "Сотрудник не важен",\
"color": "#009800",\
"icon": "unlock",\
"font_color": "#ffffff"},\
{\
"id": "104474",\
"title": "интересная категория",\
"color": "#3b2c54",\
"icon": "odnoklassniki",\
"font_color": "#ffffff"}],
"activity_id": 0,
"custom_fields": [ ],
"documents": [\
{\
"id": 8172893,\
"type_id": 7,\
"storage_id": 0,\
"user_id": 1073232,\
"company_id": 4564,\
"number": 4163,\
"comment": "",\
"date_created": "2019-01-16 12:00:00",\
"category_id": 0,\
"visit_id": 3,\
"record_id": 2,\
"type_title": "Визит",\
"is_sale_bill_printed": false}],
"sms_remain_hours": 5,
"email_remain_hours": 1,
"bookform_id": 0,
"record_from": "",
"is_mobile": 0,
"is_sale_bill_printed": false,
"consumables": [\
{\
"id": 2173068,\
"document_id": 8174153,\
"type_id": 2,\
"company_id": 4564,\
"good_id": 4853087,\
"amount": -1,\
"cost_per_unit": 0.03,\
"discount": 0,\
"cost": 0.03,\
"unit_id": 216761,\
"operation_unit_type": 2,\
"storage_id": 91548,\
"supplier_id": 0,\
"client_id": 0,\
"master_id": 0,\
"create_date": "2019-01-16 11:55:00",\
"comment": "",\
"service_id": 1,\
"user_id": 1073232,\
"deleted": false,\
"pkg_amount": 0}],
"finance_transactions": [\
{\
"id": 6024243,\
"document_id": 8174152,\
"date": "2019-01-02 09:55:00",\
"type_id": 5,\
"expense_id": 5,\
"account_id": 90459,\
"amount": 100,\
"client_id": 18936825,\
"master_id": 0,\
"supplier_id": 0,\
"comment": "",\
"item_id": 1,\
"target_type_id": 1,\
"record_id": 2,\
"goods_transaction_id": 0,\
"expense": {\
"id": 5,\
"title": "Оказание услуг"},\
"account": {\
"id": 90459,\
"title": "Основная касса"},\
"client": {\
"id": 18936825,\
"name": "lx",\
"phone": "70001234567"},\
"master": [ ],\
"supplier": [ ]}]},
"meta": [ ]}`

## [tag/Zapisi/operation/Изменить запись](https://developers.yclients.com/ru/\#tag/Zapisi/operation/%D0%98%D0%B7%D0%BC%D0%B5%D0%BD%D0%B8%D1%82%D1%8C%20%D0%B7%D0%B0%D0%BF%D0%B8%D1%81%D1%8C) Изменить запись

put/record/{company\_id}/{record\_id}

https://api.yclients.com/api/v1/record/{company\_id}/{record\_id}

При изменении записи в групповом событии параметр activity\_id становится обязательным,
параметры staff\_id, services, datetime, seance\_length становятся необязательными

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| record\_id<br>required | number<br>ID записи |

##### query Parameters

|     |     |
| --- | --- |
| include\_consumables | number<br>Example:include\_consumables=0 |
| include\_finance\_transactions | number<br>Example:include\_finance\_transactions=0 |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| staff\_id | number<br>Идентификатор сотрудника |
| services | Array of objects<br>Параметры услуг (id, стоимость, скидка) |
| client | object<br>Параметры клиента (телефон, имя, email) |
| save\_if\_busy | boolean<br>Сохранять ли запись если время занято или нерабочее, или выдать ошибку |
| datetime | string<date-time><br>Дата и время записи |
| seance\_length | number<br>Длительность записи в секундах |
| send\_sms | boolean<br>Отправлять ли смс с деталями записи клиенту |
| comment | string<br>Комментарий к записи |
| sms\_remain\_hours | number<br>За сколько часов до визита следует выслать смс напоминание клиенту (0 - если не нужно) |
| email\_remain\_hours | number<br>За сколько часов до визита следует выслать email напоминание клиенту (0 - если не нужно) |
| attendance | number<br>Статус записи (2 - Пользователь подтвердил запись, 1 - Пользователь пришел, услуги оказаны, 0 - ожидание пользователя, -1 - пользователь не пришел на визит) |
| api\_id | string<br>Идентификатор внешней системы |
| custom\_color | string<br>Цвет записи |
| record\_labels | Array of strings<br>Массив идентификаторов категорий записи |
| client\_agreements | object or null<br>Юридические соглашения клиента |
| technical\_break\_duration | number or null\[ 0 .. 3600 \]<br>Технический перерыв. <br>- Строго кратно 300 (5 минутам).<br>- Максимальное значение 3600 (1 час) <br>- Если передан `null` или значение не передано — <br>будет задан согласно настройкам в разделе _Настройки → Журнал записи → Технические перерывы_ при наличии услуг с перерывом |
| custom\_fields | object<br>Дополнительные поля записи |

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешного выполнения (true) |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"staff_id": 8886,
"services": [\
{\
"id": 331,\
"first_cost": 9000,\
"discount": 50,\
"cost": 4500},\
{\
"id": 333,\
"first_cost": 2000,\
"discount": 10,\
"cost": 1800}],
"client": {
"phone": "79169999900",
"name": "Дмитрий",
"surname": "",
"patronymic": "",
"email": "d@yclients.com"},
"save_if_busy": false,
"datetime": "2019-01-01 17:00:00",
"seance_length": 3600,
"send_sms": true,
"comment": "тестовая запись!",
"sms_remain_hours": 6,
"email_remain_hours": 24,
"attendance": 1,
"api_id": "777",
"custom_color": "f44336",
"record_labels": [\
"67345",\
"104474"],
"custom_fields": {
"my_custom_field": 123,
"some_another_field": [\
"first value",\
"second value"]},
"client_agreements": {
"is_newsletter_allowed": false,
"is_personal_data_processing_allowed": true}}`

### Response samples

- 201

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 999,
"services": [\
{\
"id": 331,\
"first_cost": 9000,\
"discount": 50,\
"cost": 4500},\
{\
"id": 333,\
"first_cost": 2000,\
"discount": 10,\
"cost": 1800}],
"client": {
"phone": "79169999900",
"name": "Дмитрий",
"surname": "",
"patronymic": "",
"email": "d@yclients.com"},
"clients_count": 1,
"staff": {
"id": 8886,
"name": "Сергей",
"specialization": "Стилист",
"position": {
"id": 1,
"title": "Стилисты"},
"avatar": "http://yclients.com/images/no-master-sm.png",
"avatar_big": "http://yclients.com/images/no-master.png",
"rating": 0,
"votes_count": 0},
"datetime": "2019-01-17 11:00:00",
"seance_length": 3600,
"create_date": "2019-01-05T15:35:06+0500",
"comment": "тестовая запись!",
"visit_attendance": 1,
"confirmed": 1,
"sms_before": 6,
"sms_now": 1,
"sms_now_text": "",
"email_now": 1,
"notified": 0,
"master_request": 1,
"api_id": "",
"from_url": "",
"review_requested": 0,
"activity_id": 0,
"documents": [\
{\
"id": 8172893,\
"type_id": 7,\
"storage_id": 0,\
"user_id": 746310,\
"company_id": 4564,\
"number": 4163,\
"comment": "",\
"date_created": "2019-01-05 15:35:06",\
"category_id": 0,\
"visit_id": 3,\
"record_id": 2,\
"type_title": "Визит"}]},
"meta": [ ]}`

## [tag/Zapisi/operation/Удалить запись](https://developers.yclients.com/ru/\#tag/Zapisi/operation/%D0%A3%D0%B4%D0%B0%D0%BB%D0%B8%D1%82%D1%8C%20%D0%B7%D0%B0%D0%BF%D0%B8%D1%81%D1%8C) Удалить запись

delete/record/{company\_id}/{record\_id}

https://api.yclients.com/api/v1/record/{company\_id}/{record\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| record\_id<br>required | number<br>ID записи |

##### query Parameters

|     |     |
| --- | --- |
| include\_consumables | number<br>Example:include\_consumables=0 |
| include\_finance\_transactions | number<br>Example:include\_finance\_transactions=0 |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**204**
No Content

# [tag/Vizity](https://developers.yclients.com/ru/\#tag/Vizity) Визиты

Для работы с визитами

## [tag/Vizity/operation/Получить визит](https://developers.yclients.com/ru/\#tag/Vizity/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D0%B2%D0%B8%D0%B7%D0%B8%D1%82) Получить визит

get/visits/{visit\_id}

https://api.yclients.com/api/v1/visits/{visit\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| visit\_id<br>required | number<br>Example:ID визита |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"attendance": 1,
"datetime": "2018-03-22T17:55:14+0300",
"comment": 0,
"records": [\
{\
"id": 37955315,\
"company_id": 4564,\
"staff_id": 55436,\
"services": [ ],\
"events": [ ],\
"goods_transactions": [ ],\
"staff": {\
"id": 55436,\
"name": "Кевин Спейси",\
"specialization": "Мастер маникюра и педикюра",\
"position": {\
"id": 1,\
"title": "Администратор"},\
"avatar": "https://yclients.com/uploads/masters/sm/b/bb/bb59d4cc17d9b16_20171215174158.png",\
"avatar_big": "https://yclients.com/uploads/masters/origin/c/cf/cfb8c5cee58000b_20171215174158.png",\
"rating": 4.89,\
"votes_count": 0},\
"client": {\
"id": 4240788,\
"name": "Иван",\
"surname": "Иванов",\
"patronymic": "Иванович",\
"phone": 71000000001,\
"card": "000000415",\
"email": "",\
"success_visits_count": 58,\
"fail_visits_count": 9},\
"date": "2018-03-22 17:55:14",\
"datetime": "2018-03-22T17:55:14+0300",\
"create_date": "2018-03-22T17:55:14+0300",\
"comment": "",\
"online": false,\
"visit_attendance": 1,\
"attendance": 1,\
"confirmed": 1,\
"seance_length": 3600,\
"length": 3600,\
"sms_before": 1,\
"sms_now": 1,\
"sms_now_text": "",\
"email_now": 1,\
"notified": 0,\
"master_request": 0,\
"api_id": "0",\
"from_url": "",\
"review_requested": 0,\
"visit_id": 8260852,\
"created_user_id": 999290,\
"deleted": 0,\
"paid_full": 0,\
"prepaid": 0,\
"prepaid_confirmed": 0,\
"last_change_date": "2018-03-28T17:46:48+0300",\
"custom_color": "",\
"custom_font_color": "",\
"record_labels": [ ],\
"activity_id": 0,\
"custom_fields": [ ],\
"documents": [\
{\
"id": 8172893,\
"type_id": 7,\
"storage_id": 0,\
"user_id": 746310,\
"company_id": 4564,\
"number": 4163,\
"comment": "",\
"date_created": "2019-01-16 12:00:00",\
"category_id": 0,\
"visit_id": 3,\
"record_id": 2,\
"type_title": "Визит",\
"is_sale_bill_printed": false}]}]},
"meta": [ ]}`

## [tag/Vizity/operation/Получить детали визита](https://developers.yclients.com/ru/\#tag/Vizity/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D0%B4%D0%B5%D1%82%D0%B0%D0%BB%D0%B8%20%D0%B2%D0%B8%D0%B7%D0%B8%D1%82%D0%B0) Получить детали визита

get/visit/details/{salon\_id}/{record\_id}/{visit\_id}

https://api.yclients.com/api/v1/visit/details/{salon\_id}/{record\_id}/{visit\_id}

**Блок "kkm\_transaction\_details\_container"**

Флаг "last\_operation\_type"

| Значение | Описание |
| --- | --- |
| 0 | Распечатать чек возврата |
| 1 | Распечатать чек продажи |

Типы всех операций c ККМ

| Значение | Описание |
| --- | --- |
| 0 | Операция продажи (активна для документа с типом "Визит") |
| 1 | Операция возврата продажи (активна для документа с типом "Визит") |
| 2 | Операция коррекции |
| 4 | Операция открытия смены |
| 5 | Операция закрытия смены |
| 9 | Операция получения статуса ККМ |
| 11 | Операция получения статуса команды ККМ |
| 12 | Операция коррекции |
| 13 | Печать X-отчёта |
| 6 | Внесение наличных |
| 7 | Изъятие наличных |

Статусы всех операций с ККМ

| Значение | Описание |
| --- | --- |
| 0 | Ошибка соединения с KKM |
| 1 | Успешно |
| 2 | Отправлен на печать |
| 3 | Ошибка выполнения |
| 4 | Ошибка проверки статуса |
| 5 | Ожидание готовности KKM |

Типы документов

| Значение | Описание |
| --- | --- |
| 1 | Продажа товара |
| 2 | Оказание услуг |
| 3 | Приход товара |
| 4 | Списание товара |
| 5 | Движение товара |
| 6 | Инвентаризация |
| 7 | Визит |
| 8 | Списание расходников |

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| salon\_id<br>required | number<br>Example:ID филиала |
| record\_id<br>required | number<br>Example:ID записи |
| visit\_id<br>required | number<br>Example:ID визита |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer access\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"payment_transactions": [\
{\
"id": 6023813,\
"document_id": 8172806,\
"date": "2022-09-20 07:00:00",\
"type_id": 5,\
"expense_id": 5,\
"account_id": 32299,\
"amount": 10,\
"client_id": 4241492,\
"master_id": 0,\
"supplier_id": 0,\
"comment": "",\
"item_id": 1162679,\
"target_type_id": 1,\
"record_id": 13136569,\
"goods_transaction_id": 0,\
"expense": {\
"id": 5,\
"title": "Оказание услуг"},\
"account": {\
"id": 32299,\
"title": "Депозиты (оплата наличными)"},\
"client": {\
"id": "4241492",\
"name": "ModulKassaClient",\
"phone": "71001001011"},\
"master": [ ],\
"supplier": [ ]}],
"loyalty_transactions": [\
{\
"id": 10614,\
"status_id": 1,\
"amount": 0.5,\
"type_id": 2,\
"program_id": 145,\
"card_id": 20013,\
"salon_group_id": 646,\
"item_id": 0,\
"item_type_id": 0,\
"item_record_id": 0,\
"goods_transaction_id": 0,\
"is_discount": false,\
"is_loyalty_withdraw": false,\
"type": {\
"id": 2,\
"title": "Начисление по программам лояльности"}}],
"kkm_transaction_details_container": {
"last_operation_type": 0,
"transactions": [\
{\
"id": 1047,\
"print_date": 1529887531,\
"printed_count": 1,\
"sum": 13,\
"type": {\
"id": 0,\
"title": "Операция продажи"},\
"status": {\
"id": 1,\
"title": "Успешно"},\
"document": {\
"id": 2045,\
"type": 7,\
"type_title": "Визит"},\
"cashier": {\
"id": 746310,\
"name": "Андрей Панов"}}]},
"items": [\
{\
"id": 0,\
"item_id": 1162679,\
"item_type_id": 1,\
"record_id": 13136569,\
"item_title": "Стрижка у ТОП-мастера",\
"amount": 2,\
"first_cost": 20,\
"manual_cost": 10,\
"discount": 50,\
"cost": 10,\
"master_id": 13136569,\
"good_id": 0,\
"service_id": 1162679,\
"event_id": 0,\
"is_service": true,\
"is_event": false,\
"is_good": false}]},
"meta": [ ]}`

## [tag/Vizity/operation/Изменить визит](https://developers.yclients.com/ru/\#tag/Vizity/operation/%D0%98%D0%B7%D0%BC%D0%B5%D0%BD%D0%B8%D1%82%D1%8C%20%D0%B2%D0%B8%D0%B7%D0%B8%D1%82) Изменить визит

put/visits/{visit\_id}/{record\_id}

https://api.yclients.com/api/v1/visits/{visit\_id}/{record\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| visit\_id<br>required | number<br>Example:ID визита |
| record\_id<br>required | number<br>Example:ID запись |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: \*/\*

|     |     |
| --- | --- |
| attendance<br>required | number<br>Статус визита (2 - Пользователь подтвердил запись, 1 - Пользователь пришел, услуги оказаны, 0 - ожидание пользователя, -1 - пользователь не пришел на визит) |
| comment<br>required | string<br>Комментарий |
| new\_transactions | Array of objects<br>Массив объектов новых товарных транзакций |
| deleted\_transaction\_ids | Array of objects<br>Массив ID экземпляров |
| goods\_transactions | Array of objects<br>Массив объектов товарных транзакций |
| services | Array of objects<br>Массив объектов с услугами |
| fast\_payment | number<br>Быстрая оплата 1 - наличными, 2 - безналичными, 129 - наличными и распечатать, 130 - безналичными и распечатать |

### Responses

**200**
OK

## [tag/Vizity/operation/Чек PDF по визиту](https://developers.yclients.com/ru/\#tag/Vizity/operation/%D0%A7%D0%B5%D0%BA%20PDF%20%D0%BF%D0%BE%20%D0%B2%D0%B8%D0%B7%D0%B8%D1%82%D1%83) Чек PDF по визиту

get/attendance/receipt\_print/{visit\_id}

https://api.yclients.com/api/v1/attendance/receipt\_print/{visit\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| visit\_id<br>required | number<br>Example:ID визита |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

### Response samples

- 200

Content type

application/pdf

Copy

```

```

# [tag/Gruppovye-sobytiya](https://developers.yclients.com/ru/\#tag/Gruppovye-sobytiya) Групповые события

Для управлениями групповыми событиями используются следующие методы

## [tag/Gruppovye-sobytiya/operation/Создание группового события](https://developers.yclients.com/ru/\#tag/Gruppovye-sobytiya/operation/%D0%A1%D0%BE%D0%B7%D0%B4%D0%B0%D0%BD%D0%B8%D0%B5%20%D0%B3%D1%80%D1%83%D0%BF%D0%BF%D0%BE%D0%B2%D0%BE%D0%B3%D0%BE%20%D1%81%D0%BE%D0%B1%D1%8B%D1%82%D0%B8%D1%8F) Создание группового события

post/activity/{company\_id}

https://api.yclients.com/api/v1/activity/{company\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| date<br>required | string<date-time><br>Дата и время |
| service\_id<br>required | number<br>Идентификатор услуги |
| staff\_id<br>required | number<br>Идентификатор сотрудника |
| capacity<br>required | number<br>Вместимость |
| resource\_instance\_ids | Array of numbers<br>Массив идентификаторов экземпляров ресурсов |
| force<br>required | boolean<br>Игнорировать ошибки (занятость мастера/ресурсов и т.п.) |
| length | number<br>Длительность события в секундах |
| color | string<br>Цвет события |
| label\_ids | Array of arrays<br>Категории событий |
| comment | string<br>Комментарий события |
| stream\_link | string<br>Ссылка на онлайн-событие |
| technical\_break\_duration | number<br>Длительность технического перерыва<br>- Если не передан. Значение по умолчанию null<br>- Значение null, соответствует общей настройке филиала, и задается в разделе _Настройки → Журнал записи → Технические перерывы_ <br>или оставляет текущее значение technical\_break\_duration при обновлении события<br>- Если значение \> 0, длинна перерыва должна быть учтена в параметре length (length должен быть передан как сумма перерыва и услуг) <br>- Параметр принимает только значения, кратные 300 (5-минутные интервалы)<br>- Максимальное допустимое значение 3600 (1 час) |
| instructions | string<br>Инструкции |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"date": "2020-01-01 12:00:00",
"service_id": 1185299,
"staff_id": 26427,
"length": 3600,
"technical_break_duration": null,
"capacity": 9,
"resource_instance_ids": [\
3127],
"force": false,
"label_ids": [\
1],
"comment": "",
"color": "",
"stream_link": "",
"instructions": ""}`

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 108,
"company_id": 4564,
"service_id": 1185299,
"staff_id": 26427,
"date": "2020-01-01 12:00:00",
"timestamp": 1577869200,
"length": 5400,
"capacity": 9,
"color": "",
"instructions": "",
"stream_link": "",
"notified": false,
"comment": "",
"records_count": 0,
"font_color": "",
"service": {
"id": 1185299,
"title": "Групповой маникюр",
"category_id": 754917},
"staff": {
"id": 26427,
"name": "Моника Белуччи",
"company_id": 4564,
"specialization": "Тренер"},
"resource_instances": [\
{\
"id": 3127,\
"title": "Машинка для маникюра #1",\
"resource_id": 1364}],
"labels": [\
{\
"id": 1,\
"title": "Название категории",\
"icon": "tag",\
"color": "#dfd4f2",\
"font_color": "#000000"}],
"duration_details": [\
{\
"id": 1,\
"services_duration": 3000,\
"technical_break_duration": 600}]},
"meta": [ ]}`

## [tag/Gruppovye-sobytiya/operation/Чтение группового события](https://developers.yclients.com/ru/\#tag/Gruppovye-sobytiya/operation/%D0%A7%D1%82%D0%B5%D0%BD%D0%B8%D0%B5%20%D0%B3%D1%80%D1%83%D0%BF%D0%BF%D0%BE%D0%B2%D0%BE%D0%B3%D0%BE%20%D1%81%D0%BE%D0%B1%D1%8B%D1%82%D0%B8%D1%8F) Чтение группового события

get/activity/{company\_id}/{activity\_id}

https://api.yclients.com/api/v1/activity/{company\_id}/{activity\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| activity\_id<br>required | number<br>ID групповой записи |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 108,
"company_id": 4564,
"service_id": 1185299,
"staff_id": 26427,
"date": "2020-01-01 12:00:00",
"timestamp": 1577869200,
"length": 3600,
"capacity": 9,
"color": "",
"instructions": "",
"stream_link": "",
"notified": false,
"comment": "",
"records_count": 0,
"font_color": "",
"service": {
"id": 1185299,
"title": "Групповой маникюр",
"category_id": 754917},
"staff": {
"id": 26427,
"name": "Моника Белуччи",
"company_id": 4564,
"specialization": "Тренер"},
"resource_instances": [\
{\
"id": 3127,\
"title": "Машинка для маникюра #1",\
"resource_id": 1364}],
"labels": [\
{\
"id": 1,\
"title": "Название категории",\
"icon": "tag",\
"color": "#dfd4f2",\
"font_color": "#000000"}],
"duration_details": [\
{\
"id": 1,\
"services_duration": 3000,\
"technical_break_duration": 600}]},
"meta": [ ]}`

## [tag/Gruppovye-sobytiya/operation/Обновление группового события](https://developers.yclients.com/ru/\#tag/Gruppovye-sobytiya/operation/%D0%9E%D0%B1%D0%BD%D0%BE%D0%B2%D0%BB%D0%B5%D0%BD%D0%B8%D0%B5%20%D0%B3%D1%80%D1%83%D0%BF%D0%BF%D0%BE%D0%B2%D0%BE%D0%B3%D0%BE%20%D1%81%D0%BE%D0%B1%D1%8B%D1%82%D0%B8%D1%8F) Обновление группового события

put/activity/{company\_id}/{activity\_id}

https://api.yclients.com/api/v1/activity/{company\_id}/{activity\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| activity\_id<br>required | number<br>ID группового события |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| date<br>required | string<date-time><br>Дата и время |
| service\_id<br>required | number<br>Идентификатор услуги |
| staff\_id<br>required | number<br>Идентификатор сотрудника |
| capacity<br>required | number<br>Вместимость |
| resource\_instance\_ids | Array of numbers<br>Массив идентификаторов экземпляров ресурсов |
| force<br>required | boolean<br>Игнорировать ошибки (занятость мастера/ресурсов и т.п.) |
| length | number<br>Длительность события в секундах |
| color | string<br>Цвет события |
| label\_ids | Array of arrays<br>Категории событий |
| comment | string<br>Комментарий события |
| stream\_link | string<br>Ссылка на онлайн-событие |
| technical\_break\_duration | number<br>Длительность технического перерыва<br>- Если не передан. Значение по умолчанию null<br>- Значение null, соответствует общей настройке филиала, и задается в разделе _Настройки → Журнал записи → Технические перерывы_ <br>или оставляет текущее значение technical\_break\_duration при обновлении события<br>- Если значение \> 0, длинна перерыва должна быть учтена в параметре length (length должен быть передан как сумма перерыва и услуг) <br>- Параметр принимает только значения, кратные 300 (5-минутные интервалы)<br>- Максимальное допустимое значение 3600 (1 час) |
| instructions | string<br>Инструкции |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"date": "2020-01-01 12:00:00",
"service_id": 1185299,
"staff_id": 26427,
"length": 3600,
"technical_break_duration": null,
"capacity": 9,
"resource_instance_ids": [\
3127],
"force": false,
"label_ids": [\
1],
"comment": "",
"color": "",
"stream_link": "",
"instructions": ""}`

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 108,
"company_id": 4564,
"service_id": 1185299,
"staff_id": 26427,
"date": "2020-01-01 12:00:00",
"timestamp": 1577869200,
"length": 3600,
"capacity": 9,
"color": "",
"instructions": "",
"stream_link": "",
"notified": false,
"comment": "",
"records_count": 0,
"font_color": "",
"service": {
"id": 1185299,
"title": "Групповой маникюр",
"category_id": 754917},
"staff": {
"id": 26427,
"name": "Моника Белуччи",
"company_id": 4564,
"specialization": "Тренер"},
"resource_instances": [\
{\
"id": 3127,\
"title": "Машинка для маникюра #1",\
"resource_id": 1364}],
"labels": [\
{\
"id": 1,\
"title": "Название категории",\
"icon": "tag",\
"color": "#dfd4f2",\
"font_color": "#000000"}],
"duration_details": [\
{\
"id": 1,\
"services_duration": 3000,\
"technical_break_duration": 600}]}}`

## [tag/Gruppovye-sobytiya/operation/Удаление группового события](https://developers.yclients.com/ru/\#tag/Gruppovye-sobytiya/operation/%D0%A3%D0%B4%D0%B0%D0%BB%D0%B5%D0%BD%D0%B8%D0%B5%20%D0%B3%D1%80%D1%83%D0%BF%D0%BF%D0%BE%D0%B2%D0%BE%D0%B3%D0%BE%20%D1%81%D0%BE%D0%B1%D1%8B%D1%82%D0%B8%D1%8F) Удаление группового события

delete/activity/{company\_id}/{activity\_id}

https://api.yclients.com/api/v1/activity/{company\_id}/{activity\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| activity\_id<br>required | number<br>ID групповой записи |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**202**
Accepted

### Response samples

- 202

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"meta": {
"message": "Accepted"}}`

## [tag/Gruppovye-sobytiya/operation/api.location.activity.filters](https://developers.yclients.com/ru/\#tag/Gruppovye-sobytiya/operation/api.location.activity.filters) Фильтры групповых событий

get/activity/{company\_id}/filters/

https://api.yclients.com/api/v1/activity/{company\_id}/filters/

##### Authorizations:

_BearerPartner_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |

##### query Parameters

|     |     |
| --- | --- |
| service\_ids | Array of integers<br>Example:service\_ids=123<br>Фильтр по ID услуг. |
| staff\_ids | Array of integers<br>Example:staff\_ids=456<br>Фильтр по ID сотрудников филиала. |
| resource\_ids | Array of integers<br>Example:resource\_ids=789<br>Фильтр по ID ресурсов. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | Array of objects (Объект "Фильтр для поиска событий") |
| meta | object (Объект дополнительной информации о запросе с кол-вом найденных результатов) <br>Дополнительная информация о запросе. |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"code": "staff",\
"title": "Сотрудник",\
"data": [\
{\
"id": 1,\
"title": "Имя 1",\
"is_disabled": true},\
{\
"id": 2,\
"title": "Имя 2",\
"is_disabled": false}]},\
{\
"code": "service",\
"title": "Услуга",\
"data": [\
{\
"id": 1,\
"title": "Услуга 1",\
"is_disabled": true},\
{\
"id": 2,\
"title": "Услуга 2",\
"is_disabled": false}]},\
{\
"code": "resource",\
"title": "Ресурс",\
"data": [\
{\
"id": 1,\
"title": "Ресурс 1",\
"is_disabled": true},\
{\
"id": 2,\
"title": "Ресурс 2",\
"is_disabled": false}]},\
{\
"code": "service_category",\
"title": "Категория услуг",\
"data": [\
{\
"id": 1,\
"title": "Категория 1",\
"is_disabled": true},\
{\
"id": 2,\
"title": "Категория 2",\
"is_disabled": false}]}],
"meta": {
"count": 4}}`

## [tag/Gruppovye-sobytiya/operation/api.location.activity.search_dates_range](https://developers.yclients.com/ru/\#tag/Gruppovye-sobytiya/operation/api.location.activity.search_dates_range) Поиск диапазона дат групповых событий

get/activity/{company\_id}/search\_dates\_range/

https://api.yclients.com/api/v1/activity/{company\_id}/search\_dates\_range/

##### Authorizations:

_BearerPartner_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |

##### query Parameters

|     |     |
| --- | --- |
| service\_ids | Array of integers<br>Example:service\_ids=123<br>Фильтр по ID услуг. |
| staff\_ids | Array of integers<br>Example:staff\_ids=456<br>Фильтр по ID сотрудников филиала. |
| resource\_ids | Array of integers<br>Example:resource\_ids=789<br>Фильтр по ID ресурсов. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object (Объект "Диапазон данных для поиска событий") <br>Диапазон данных для поиска событий. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"min_date": "2023-06-01",
"max_date": "2023-07-15"},
"meta": [ ]}`

## [tag/Gruppovye-sobytiya/operation/api.location.activity.search_dates](https://developers.yclients.com/ru/\#tag/Gruppovye-sobytiya/operation/api.location.activity.search_dates) Поиск дат групповых событий

get/activity/{company\_id}/search\_dates/

https://api.yclients.com/api/v1/activity/{company\_id}/search\_dates/

##### Authorizations:

_BearerPartner_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |

##### query Parameters

|     |     |
| --- | --- |
| from<br>required | string<br>Example:from=2023-06-01<br>Дата начала поиска (формат ГГГГ-ММ-ДД). |
| till<br>required | string<br>Example:till=2023-07-15<br>Дата окончания поиска (формат ГГГГ-ММ-ДД). |
| service\_ids | Array of integers<br>Example:service\_ids=123<br>Фильтр по ID услуг. |
| staff\_ids | Array of integers<br>Example:staff\_ids=456<br>Фильтр по ID сотрудников филиала. |
| resource\_ids | Array of integers<br>Example:resource\_ids=789<br>Фильтр по ID ресурсов. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

### Responses

**200**
OK

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
"2023-06-01",\
"2023-06-02",\
"2023-06-08",\
"2023-07-04",\
"2023-07-15"],
"meta": [ ]}`

## [tag/Gruppovye-sobytiya/operation/api.location.activity.search](https://developers.yclients.com/ru/\#tag/Gruppovye-sobytiya/operation/api.location.activity.search) Поиск групповых событий

get/activity/{company\_id}/search/

https://api.yclients.com/api/v1/activity/{company\_id}/search/

##### Authorizations:

_BearerPartner_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |

##### query Parameters

|     |     |
| --- | --- |
| from<br>required | string<br>Example:from=2023-06-01<br>Дата начала поиска (формат ГГГГ-ММ-ДД). |
| till<br>required | string<br>Example:till=2023-07-15<br>Дата окончания поиска (формат ГГГГ-ММ-ДД). |
| service\_ids | Array of integers<br>Example:service\_ids=123<br>Фильтр по ID услуг. |
| staff\_ids | Array of integers<br>Example:staff\_ids=456<br>Фильтр по ID сотрудников филиала. |
| resource\_ids | Array of integers<br>Example:resource\_ids=789<br>Фильтр по ID ресурсов. |
| page | number<br>Example:page=1<br>Номер страницы (по умолчанию 1). |
| count | number<br>Example:count=25<br>Количество элементов на странице (по умолчанию 25). |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | object<br>Метаданные (содержит в себе количество найденных событий) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 3480140,\
"service_id": 5243360,\
"company_id": 68570,\
"staff_id": 921105,\
"date": 1622717400,\
"length": 3600,\
"capacity": 40,\
"records_count": 0,\
"color": "",\
"instructions": "",\
"stream_link": "",\
"font_color": "",\
"notified": false,\
"prepaid": "forbidden",\
"service": {\
"id": 5243360,\
"category_id": 5092305,\
"title": "Лекция по психоанализу",\
"price_min": 500,\
"price_max": 500,\
"comment": "Нет",\
"image_url": "",\
"salon_service_id": 5792535,\
"prepaid": "forbidden",\
"category": {\
"id": 5092305,\
"category_id": 1,\
"title": "Психоанализ"}},\
"staff": {\
"id": 921105,\
"name": "Натали",\
"company_id": 68570,\
"specialization": "Психотерапевт",\
"rating": 4.57,\
"show_rating": 0,\
"avatar": "https://yclients.com/images/no-master-sm.png",\
"avatar_big": "https://yclients.com/images/no-master-sm.png",\
"comments_count": 7,\
"votes_count": 0,\
"average_score": 4.57,\
"prepaid": "forbidden",\
"position": {\
"id": 123340,\
"title": "Психотерапевт"}},\
"resource_instances": [\
{\
"id": 83030,\
"title": "Кабинет психотерапевта. #1",\
"resource_id": 34895}],\
"labels": [ ]}],
"meta": {
"count": 1}}`

## [tag/Gruppovye-sobytiya/operation/Поиск групповых услуг](https://developers.yclients.com/ru/\#tag/Gruppovye-sobytiya/operation/%D0%9F%D0%BE%D0%B8%D1%81%D0%BA%20%D0%B3%D1%80%D1%83%D0%BF%D0%BF%D0%BE%D0%B2%D1%8B%D1%85%20%D1%83%D1%81%D0%BB%D1%83%D0%B3) Поиск групповых услуг

get/activity/{company\_id}/services?staff\_id=1&term=test

https://api.yclients.com/api/v1/activity/{company\_id}/services?staff\_id=1&term=test

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:4564<br>ID компании |

##### query Parameters

|     |     |
| --- | --- |
| staff\_id | number<br>Идентификатор сотрудника для фильтрации |
| term | string<br>Поиске по названию или части названия услуги |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| staff\_id | number<br>Идентификатор сотрудника для фильтрации |
| term | string<br>Поиск по названию или части названия услуги |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | object<br>Метаданные (содержит количество найденных услуг) |

### Request samples

- Payload

Content type

application/json

Copy

`{
"staff_id": 1,
"term": "test"}`

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 1209148,\
"title": "Фитнес test",\
"capacity": 5,\
"price_min": 2,\
"price_max": 3,\
"is_multi": true,\
"category": {\
"id": 1285356,\
"title": "Групповые услуги"},\
"staff": [\
{\
"id": 37695,\
"name": "Ким Кардашьян",\
"length": 7200}],\
"resources": [\
{\
"id": 464,\
"title": "Массажный кабинет",\
"salon_id": 4564}]}],
"meta": {
"count": 1}}`

## [tag/Gruppovye-sobytiya/operation/Получение стратегий дублирования групповых событий](https://developers.yclients.com/ru/\#tag/Gruppovye-sobytiya/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B5%D0%BD%D0%B8%D0%B5%20%D1%81%D1%82%D1%80%D0%B0%D1%82%D0%B5%D0%B3%D0%B8%D0%B9%20%D0%B4%D1%83%D0%B1%D0%BB%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D1%8F%20%D0%B3%D1%80%D1%83%D0%BF%D0%BF%D0%BE%D0%B2%D1%8B%D1%85%20%D1%81%D0%BE%D0%B1%D1%8B%D1%82%D0%B8%D0%B9) Получение стратегий дублирования групповых событий

get/activity/{company\_id}/duplication\_strategy

https://api.yclients.com/api/v1/activity/{company\_id}/duplication\_strategy

Дублирование событий происходит на основе набора параметров, объединенных в сущность "стратегия дублирования"

| Поле | Тип | Описание |
| --- | --- | --- |
| title | string | Название стратегии |
| repeat\_mode\_id | integer | Режим повторения |
| days | integer\[\] | Перечень дней недели: 0 вс, 6 пт |
| interval | integer | Перерыв в поиске дат, в единицах типа |
| content\_type | integer | Дублировать записи? 1 - нет, 2 - да |

Режим повторения может принимать значения

| Значение | Описание | Единица измерения перерыва |
| --- | --- | --- |
| 1 | Ежедневно | День |
| 2 | По будням | - |
| 3 | Пн Ср Пт | - |
| 4 | Вт Чт | - |
| 5 | Каждую неделю | Неделя |
| 6 | Каждый месяц | Месяц |
| 7 | Каждый год | Год |

Поле days актуально только для режима 5 - неделя, для указания конкретных дней повторения
Если указать repeat\_mode = 5, days = \[1,4\], interval = 2, то событие будет
повторяться каждую 3ю неделю в пн и чт

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:4564<br>ID компании |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 2,\
"company_id": 4564,\
"title": "Тестовый шаблон",\
"repeat_mode_id": 1,\
"repeat_mode": {\
"id": 1,\
"title": "Ежедневно"},\
"days": [ ],\
"interval": 0,\
"content_type": 1}],
"meta": {
"count": 1}}`

## [tag/Gruppovye-sobytiya/operation/Создание шаблона дублирования группового события](https://developers.yclients.com/ru/\#tag/Gruppovye-sobytiya/operation/%D0%A1%D0%BE%D0%B7%D0%B4%D0%B0%D0%BD%D0%B8%D0%B5%20%D1%88%D0%B0%D0%B1%D0%BB%D0%BE%D0%BD%D0%B0%20%D0%B4%D1%83%D0%B1%D0%BB%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D1%8F%20%D0%B3%D1%80%D1%83%D0%BF%D0%BF%D0%BE%D0%B2%D0%BE%D0%B3%D0%BE%20%D1%81%D0%BE%D0%B1%D1%8B%D1%82%D0%B8%D1%8F) Создание шаблона дублирования группового события

post/activity/{company\_id}/duplication\_strategy

https://api.yclients.com/api/v1/activity/{company\_id}/duplication\_strategy

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: \*/\*

|     |     |
| --- | --- |
| title<br>required | string<br>Название |
| days | Array of objects<br>Дни повторений для недельного режима |
| repeat\_mode\_id<br>required | number<br>Режим повторений |
| interval | number<br>Перерыв в поиске дат |
| content\_type | number<br>Дублировать записи? 1 - нет, 2 - да |

### Responses

**200**
OK

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 3,
"company_id": 4564,
"title": "Test duplication strategy",
"repeat_mode_id": 5,
"repeat_mode": {
"id": 5,
"title": "Каждую неделю"},
"days": [\
1,\
4],
"interval": 2,
"content_type": 1},
"meta": [ ]}`

## [tag/Gruppovye-sobytiya/operation/Обновление шаблона дублирования группового события](https://developers.yclients.com/ru/\#tag/Gruppovye-sobytiya/operation/%D0%9E%D0%B1%D0%BD%D0%BE%D0%B2%D0%BB%D0%B5%D0%BD%D0%B8%D0%B5%20%D1%88%D0%B0%D0%B1%D0%BB%D0%BE%D0%BD%D0%B0%20%D0%B4%D1%83%D0%B1%D0%BB%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D1%8F%20%D0%B3%D1%80%D1%83%D0%BF%D0%BF%D0%BE%D0%B2%D0%BE%D0%B3%D0%BE%20%D1%81%D0%BE%D0%B1%D1%8B%D1%82%D0%B8%D1%8F) Обновление шаблона дублирования группового события

post/activity/{company\_id}/duplication\_strategy/{strategy\_id}

https://api.yclients.com/api/v1/activity/{company\_id}/duplication\_strategy/{strategy\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:4564<br>ID компании |
| strategy\_id<br>required | number<br>Example:3<br>ID стратегии дублирования |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: \*/\*

|     |     |
| --- | --- |
| title<br>required | string<br>Название |
| days | Array of objects<br>Дни повторений для недельного режима |
| repeat\_mode\_id<br>required | number<br>Режим повторений |
| interval | number<br>Перерыв в поиске дат |
| content\_type | number<br>Дублировать записи? 1 - нет, 2 - да |

### Responses

**200**
OK

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 3,
"company_id": 4564,
"title": "New test duplication strategy",
"repeat_mode_id": 5,
"repeat_mode": {
"id": 5,
"title": "Каждую неделю"},
"days": [\
2,\
3],
"interval": 3,
"content_type": 1},
"meta": [ ]}`

## [tag/Gruppovye-sobytiya/operation/Запрос дублирования группового события](https://developers.yclients.com/ru/\#tag/Gruppovye-sobytiya/operation/%D0%97%D0%B0%D0%BF%D1%80%D0%BE%D1%81%20%D0%B4%D1%83%D0%B1%D0%BB%D0%B8%D1%80%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D1%8F%20%D0%B3%D1%80%D1%83%D0%BF%D0%BF%D0%BE%D0%B2%D0%BE%D0%B3%D0%BE%20%D1%81%D0%BE%D0%B1%D1%8B%D1%82%D0%B8%D1%8F) Запрос дублирования группового события

post/activity/{company\_id}/{activity\_id}/duplicate/

https://api.yclients.com/api/v1/activity/{company\_id}/{activity\_id}/duplicate/

Запрос на дублирование можно оформить 3 способами:

- Указав список дат и времени для дублирования

- Указав id стратегии повторения

- Указав все параметры повторения


##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:1 |
| activity\_id<br>required | number<br>Example:2 |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

object

### Responses

**200**
OK

**409**
Conflict

### Request samples

- Payload

Content type

application/json

Copy

`{ }`

### Response samples

- 200
- 409

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 9182,\
"service_id": 1209148,\
"salon_id": 4564,\
"master_id": 1000265,\
"date": 1601289000,\
"length": 7200,\
"capacity": 5,\
"records_count": 0,\
"color": "",\
"instructions": "",\
"stream_link": "",\
"font_color": "",\
"notified": false,\
"timestamp": 1601274600,\
"service": {\
"id": 1209148,\
"category_id": 1285356,\
"title": "Фитнес \"test\"",\
"price_min": 2,\
"price_max": 3,\
"prepaid": "forbidden"},\
"resource_instances": [\
{\
"id": 1094,\
"title": "Массажный кабинет 1 этаж",\
"resource_id": 464}],\
"master": {\
"id": 1000265,\
"name": "Master",\
"company_id": 4564,\
"specialization": "321",\
"rating": 0,\
"show_rating": 1,\
"prepaid": "allowed",\
"position": [ ]},\
"records": [ ],\
"labels": [ ]}],
"meta": {
"count": 2}}`

# [tag/Gruppovye-sobytiya-v2](https://developers.yclients.com/ru/\#tag/Gruppovye-sobytiya-v2) Групповые события v2

Новое окно групповых событий

## [tag/Gruppovye-sobytiya-v2/operation/api_v2.company.activities.create](https://developers.yclients.com/ru/\#tag/Gruppovye-sobytiya-v2/operation/api_v2.company.activities.create) Создание события

post/api/v2/companies/{salonId}/activities

https://api.yclients.com/api/v1/api/v2/companies/{salonId}/activities

Создаёт групповое событие.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| salonId<br>required | string<br>Example:45<br>Идентификатор филиала. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| staff\_id<br>required | integer<br>Идентификатор мастера. |
| service\_id<br>required | integer<br>Идентификатор услуги. |
| resource\_instance\_ids | Array of integers<br>Список идентификаторов ресурса. |
| label\_ids | Array of integers<br>Список идентификаторов категорий. |
| date<br>required | string<date-time><br>Дата события. |
| length<br>required | integer<br>Продолжительность события в секундах. |
| technical\_break\_duration | number<br>Длительность технического перерыва<br>- Если не передан. Значение по умолчанию null<br>- Значение null, соответствует общей настройке филиала, и задается в разделе _Настройки → Журнал записи → Технические перерывы_ <br>или оставляет текущее значение technical\_break\_duration при обновлении события<br>- Если значение \> 0, длинна перерыва должна быть учтена в параметре length (length должен быть передан как сумма перерыва и услуг) <br>- Параметр принимает только значения, кратные 300 (5-минутные интервалы)<br>- Максимальное допустимое значение 3600 (1 час) |
| capacity<br>required | integer<br>Количество мест в событии. |
| comment | string<br>Комментарий. |
| color | string<br>Цвет события. |
| instructions | string<br>Инструкции. |
| stream\_link | string<br>Ссылка для подключения. |
| force | boolean<br>Признак проверки доступности ресурсов (true - не проверяем, false - проверяем). |

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| data | object |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"staff_id": 1,
"service_id": 500,
"resource_instance_ids": [\
123,\
432],
"label_ids": [\
123,\
432],
"date": "2024-11-22 14:00:00",
"length": 3600,
"technical_break_duration": 0,
"capacity": 4,
"comment": "Занятие с начинающей группой",
"color": "#9c27b0",
"instructions": "Взять два мяча",
"stream_link": "https://stream.com/some_link",
"force": false}`

### Response samples

- 201
- 401
- 403
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"data": {
"type": "record",
"id": "335",
"attributes": {
"id": 777,
"master_id": 333,
"staff_id": 333,
"service_id": 4,
"timestamp": 1737035740,
"length": 3600,
"capacity": 4,
"clients_count": 4,
"color": 30,
"instructions": "Взять мяч",
"stream_link": "http://stream.com",
"font_color": "#rrggbb",
"notified": true,
"comment": "Комментарий",
"schedule_id": 3,
"schedule_till": "2025-11-22 14:00:00"}}}`

## [tag/Gruppovye-sobytiya-v2/operation/api_v2.company.activities.read](https://developers.yclients.com/ru/\#tag/Gruppovye-sobytiya-v2/operation/api_v2.company.activities.read) Чтение события

get/api/v2/companies/{salonId}/activities/{activityId}

https://api.yclients.com/api/v1/api/v2/companies/{salonId}/activities/{activityId}

Возвращает групповое событие.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| salonId<br>required | string<br>Example:45<br>Идентификатор события. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| data | object |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Response samples

- 201
- 401
- 403
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"data": {
"type": "record",
"id": "335",
"attributes": {
"id": 777,
"master_id": 333,
"staff_id": 333,
"service_id": 4,
"timestamp": 1737035740,
"length": 3600,
"capacity": 4,
"clients_count": 4,
"color": 30,
"instructions": "Взять мяч",
"stream_link": "http://stream.com",
"font_color": "#rrggbb",
"notified": true,
"comment": "Комментарий",
"schedule_id": 3,
"schedule_till": "2025-11-22 14:00:00"}}}`

## [tag/Gruppovye-sobytiya-v2/operation/api_v2.company.activities.update](https://developers.yclients.com/ru/\#tag/Gruppovye-sobytiya-v2/operation/api_v2.company.activities.update) Обновление события

put/api/v2/companies/{salonId}/activities/{activityId}

https://api.yclients.com/api/v1/api/v2/companies/{salonId}/activities/{activityId}

Обновляет групповое событие.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| salonId<br>required | string<br>Example:45<br>Идентификатор филиала. |
| salonId<br>required | string<br>Example:45<br>Идентификатор события. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| staff\_id<br>required | integer<br>Идентификатор мастера. |
| service\_id<br>required | integer<br>Идентификатор услуги. |
| resource\_instance\_ids | Array of integers<br>Список идентификаторов ресурса. |
| label\_ids | Array of integers<br>Список идентификаторов категорий. |
| date<br>required | string<date-time><br>Дата события. |
| length<br>required | integer<br>Продолжительность события в секундах. |
| technical\_break\_duration | number<br>Длительность технического перерыва<br>- Если не передан. Значение по умолчанию null<br>- Значение null, соответствует общей настройке филиала, и задается в разделе _Настройки → Журнал записи → Технические перерывы_ <br>или оставляет текущее значение technical\_break\_duration при обновлении события<br>- Если значение \> 0, длинна перерыва должна быть учтена в параметре length (length должен быть передан как сумма перерыва и услуг) <br>- Параметр принимает только значения, кратные 300 (5-минутные интервалы)<br>- Максимальное допустимое значение 3600 (1 час) |
| capacity<br>required | integer<br>Количество мест в событии. |
| comment | string<br>Комментарий. |
| color | string<br>Цвет события. |
| instructions | string<br>Инструкции. |
| stream\_link | string<br>Ссылка для подключения. |
| force | boolean<br>Признак проверки доступности ресурсов (true - не проверяем, false - проверяем). |

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| data | object |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"staff_id": 1,
"service_id": 500,
"resource_instance_ids": [\
123,\
432],
"label_ids": [\
123,\
432],
"date": "2024-11-22 14:00:00",
"length": 3600,
"technical_break_duration": 0,
"capacity": 4,
"comment": "Занятие с начинающей группой",
"color": "#9c27b0",
"instructions": "Взять два мяча",
"stream_link": "https://stream.com/some_link",
"force": false}`

### Response samples

- 201
- 401
- 403
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"data": {
"type": "record",
"id": "335",
"attributes": {
"id": 777,
"master_id": 333,
"staff_id": 333,
"service_id": 4,
"timestamp": 1737035740,
"length": 3600,
"capacity": 4,
"clients_count": 4,
"color": 30,
"instructions": "Взять мяч",
"stream_link": "http://stream.com",
"font_color": "#rrggbb",
"notified": true,
"comment": "Комментарий",
"schedule_id": 3,
"schedule_till": "2025-11-22 14:00:00"}}}`

## [tag/Gruppovye-sobytiya-v2/operation/api_v2.company.activities.delete](https://developers.yclients.com/ru/\#tag/Gruppovye-sobytiya-v2/operation/api_v2.company.activities.delete) Удаление события

delete/api/v2/companies/{salonId}/activities/{activityId}

https://api.yclients.com/api/v1/api/v2/companies/{salonId}/activities/{activityId}

Удаляет групповое событие.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| salonId<br>required | string<br>Example:45<br>Идентификатор филиала. |
| salonId<br>required | string<br>Example:45<br>Идентификатор события. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

### Responses

**204**
No Content

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Response samples

- 401
- 403
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": false,
"data": null,
"meta": {
"message": "Необходима авторизация"}}`

## [tag/Gruppovye-sobytiya-v2/operation/api_v2.company.activities.create](https://developers.yclients.com/ru/\#tag/Gruppovye-sobytiya-v2/operation/api_v2.company.activities.create) Создание записи в событии

post/api/v2/companies/{salonId}/activities/{activityId}/records

https://api.yclients.com/api/v1/api/v2/companies/{salonId}/activities/{activityId}/records

Создаёт запись в групповом событии.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| salonId<br>required | string<br>Example:45<br>Идентификатор филиала. |
| salonId<br>required | string<br>Example:45<br>Идентификатор события. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| client\_id | integer<br>Идентификатор клиента. |
| comer\_id | integer<br>Идентификатор посетителя. |
| client<br>required | object |
| comer | object<br>Посетитель. |
| labels | Array of integers<br>Идентификаторы категорий записи. |
| clients\_count<br>required | integer<br>Количество посетителей. |

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| data | object |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"client_id": 1,
"comer_id": 500,
"client": {
"id": 0,
"client": {
"name": "Лера",
"phone_string": "79473920947",
"email": "mail@mail.com.",
"surname": "Иванова",
"patronymic": "Дмитриевна",
"sex": 2,
"birthday": "2000-03-22",
"custom_field_values": [\
{\
"code": "my_text_field1",\
"value": "some value"}],
"agreements": [\
{\
"is_newsletter_allowed": true,\
"is_personal_data_processing_allowed": true}]}},
"comer": {
"name": "Иван"},
"labels": [\
0],
"clients_count": 3}`

### Response samples

- 201
- 401
- 403
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"data": {
"type": "record",
"id": "335",
"attributes": {
"id": 777,
"master_id": 333,
"staff_id": 333,
"service_id": 4,
"timestamp": 1737035740,
"length": 3600,
"capacity": 4,
"clients_count": 4,
"color": 30,
"instructions": "Взять мяч",
"stream_link": "http://stream.com",
"font_color": "#rrggbb",
"notified": true,
"comment": "Комментарий",
"schedule_id": 3,
"schedule_till": "2025-11-22 14:00:00"}}}`

## [tag/Gruppovye-sobytiya-v2/operation/api_v2.company.activities.create](https://developers.yclients.com/ru/\#tag/Gruppovye-sobytiya-v2/operation/api_v2.company.activities.create) Создание записи в событии

post/api/v2/companies/{salonId}/activities/{activityId}/records/{recordId}

https://api.yclients.com/api/v1/api/v2/companies/{salonId}/activities/{activityId}/records/{recordId}

Создаёт запись в групповом событии.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| salonId<br>required | string<br>Example:45<br>Идентификатор филиала. |
| salonId<br>required | string<br>Example:45<br>Идентификатор события. |
| salonId<br>required | string<br>Example:45<br>Идентификатор записи. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| attendance\_service\_item<br>required | object<br>Услуги. |
| attendance\_good\_items | Array of objects<br>Товары. |
| comment | string<br>Комментарий. |
| label\_ids | Array of integers<br>Список идентификаторов категорий. |
| color | string<br>Цвет. |
| clients\_count<br>required | integer<br>Количество посетителей. |

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| data | object |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"attendance_service_item": {
"cost_per_unit": 100,
"discount_percent": 100,
"manual_cost": 100},
"attendance_good_items": [\
{\
"id": 10,\
"good_id": 100,\
"unit_id": 10,\
"storage_id": 15,\
"staff_id": 33,\
"operation_unit_type": "",\
"number": 51,\
"planned_activation_date": "2025-02-15 15:00:00",\
"marks": [\
"3",\
"5"],\
"quantity": 1,\
"cost_per_unit": 100,\
"manual_cost": 100,\
"discount_percent": 100}],
"comment": "Комментарий",
"label_ids": [\
123,\
432],
"color": "f44336",
"clients_count": 5}`

### Response samples

- 201
- 401
- 403
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"data": {
"type": "record",
"id": "335",
"attributes": {
"id": 777,
"master_id": 333,
"staff_id": 333,
"service_id": 4,
"timestamp": 1737035740,
"length": 3600,
"capacity": 4,
"clients_count": 4,
"color": 30,
"instructions": "Взять мяч",
"stream_link": "http://stream.com",
"font_color": "#rrggbb",
"notified": true,
"comment": "Комментарий",
"schedule_id": 3,
"schedule_till": "2025-11-22 14:00:00"}}}`

# [tag/Grafik-raboty-sotrudnika](https://developers.yclients.com/ru/\#tag/Grafik-raboty-sotrudnika) График работы сотрудника

Для управления графиками работы сотрудников в филиале

## [tag/Grafik-raboty-sotrudnika/operation/api.location.staff.schedule.read](https://developers.yclients.com/ru/\#tag/Grafik-raboty-sotrudnika/operation/api.location.staff.schedule.read) Получение графиков работы сотрудников

get/company/{company\_id}/staff/schedule

https://api.yclients.com/api/v1/company/{company\_id}/staff/schedule

Осуществляет поиск графиков сотрудников в виде рабочих интервалов с опциональным включением интервалов, занятых записями/событиями, а также типов нерабочих дней.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |

##### query Parameters

|     |     |
| --- | --- |
| start\_date | string<date><br>Example:start\_date=2024-01-31<br>Дата начала поиска расписаний сотрудников в формате Y-m-d. |
| end\_date | string<date><br>Example:end\_date=2024-03-31<br>Дата окончания поиска расписаний сотрудников в формате Y-m-d. |
| staff\_ids | Array of numbers<br>Набор идентификаторов сотрудников, по которым должен осуществляться поиск расписаний.<br>Пример: `staff_ids[]=123&staff_ids[]=234`. |
| include | Array of strings<br>ItemsEnum:"busy\_intervals""off\_day\_type"<br>Набор сущностей, которые должны быть включены в ответ.<br>Пример: `include[]=busy_intervals&include[]=off_day_type`. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | Array of objects (Объект модели "Расписание сотрудника") |
| meta | object (Объект дополнительной информации о запросе с кол-вом найденных результатов) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

### Response samples

- 200
- 401
- 403
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"staff_id": 123,\
"date": "2024-01-31",\
"slots": [\
{\
"from": "10:00",\
"to": "12:00"},\
{\
"from": "13:00",\
"to": "19:00"}],\
"busy_intervals": [\
{\
"entity_type": "record",\
"entity_id": 123,\
"from": "11:00",\
"to": "12:00"},\
{\
"entity_type": "activity",\
"entity_id": 123,\
"from": "15:00",\
"to": "16:00"}],\
"off_day_type": 3}],
"meta": {
"count": 10}}`

## [tag/Grafik-raboty-sotrudnika/operation/api.location.staff.schedule.set](https://developers.yclients.com/ru/\#tag/Grafik-raboty-sotrudnika/operation/api.location.staff.schedule.set) Установка графиков работы сотрудников

put/company/{company\_id}/staff/schedule

https://api.yclients.com/api/v1/company/{company\_id}/staff/schedule

Устанавливает графики работы сотрудников по заданным интервалам, после чего возвращает результирующие графики измененных сотрудников в интервале с минимальной измененной даты до максимальной.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| schedules\_to\_set | Array of objects<br>Массив объектов с графиками работы сотрудников на конкретные даты. |
| schedules\_to\_delete | Array of objects<br>Массив объектов с параметрами удаления графиков сотрудников на конкретные даты. |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | Array of objects (Объект модели "Расписание сотрудника") |
| meta | object (Объект дополнительной информации о запросе с кол-вом найденных результатов) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"schedules_to_set": [\
{\
"staff_id": 123,\
"dates": [\
"2024-01-31",\
"2024-02-01"],\
"slots": [\
{\
"from": "10:00",\
"to": "19:00"}]}],
"schedules_to_delete": [\
{\
"staff_id": 123,\
"dates": [\
"2024-01-31",\
"2024-02-01"]}]}`

### Response samples

- 200
- 401
- 403
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"staff_id": 123,\
"date": "2024-01-31",\
"slots": [\
{\
"from": "10:00",\
"to": "12:00"},\
{\
"from": "13:00",\
"to": "19:00"}],\
"busy_intervals": [\
{\
"entity_type": "record",\
"entity_id": 123,\
"from": "11:00",\
"to": "12:00"},\
{\
"entity_type": "activity",\
"entity_id": 123,\
"from": "15:00",\
"to": "16:00"}],\
"off_day_type": 3}],
"meta": {
"count": 10}}`

## [tag/Grafik-raboty-sotrudnika/operation/Получить расписание сотрудника](https://developers.yclients.com/ru/\#tag/Grafik-raboty-sotrudnika/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%80%D0%B0%D1%81%D0%BF%D0%B8%D1%81%D0%B0%D0%BD%D0%B8%D0%B5%20%D1%81%D0%BE%D1%82%D1%80%D1%83%D0%B4%D0%BD%D0%B8%D0%BA%D0%B0) Устаревшее. Получить расписание сотрудника Deprecated

get/schedule/{company\_id}/{staff\_id}/{start\_date}/{end\_date}

https://api.yclients.com/api/v1/schedule/{company\_id}/{staff\_id}/{start\_date}/{end\_date}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| staff\_id<br>required | number<br>ID сотрудника. |
| start\_date<br>required | date<br>Example:2023-01-01<br>Дата начала периода |
| end\_date<br>required | date<br>Example:2023-03-01<br>Дата окончания периода |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| date<br>required | string<br>дата в формате iso8601. |
| is\_working<br>required | boolean<br>Свободно время или нет. |
| slots | Array of objects<br>Массив (from, to) промежутков рабочего времени. |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"date": "2023-01-01",\
"is_working": 1,\
"slots": [\
{\
"from": "10:00",\
"to": "14:00"},\
{\
"from": "15:00",\
"to": "23:15"}]},\
{\
"date": "2023-01-02",\
"is_working": 1,\
"slots": [\
{\
"from": "10:00",\
"to": "14:30"},\
{\
"from": "15:00",\
"to": "22:10"}]},\
{\
"date": "2023-01-03",\
"is_working": 0,\
"slots": [ ]},\
{\
"date": "2023-01-04",\
"is_working": 1,\
"slots": [\
{\
"from": "10:00",\
"to": "14:00"},\
{\
"from": "15:00",\
"to": "22:00"}]}],
"meta": [ ]}`

## [tag/Grafik-raboty-sotrudnika/operation/Изменить расписание работы сотрудника](https://developers.yclients.com/ru/\#tag/Grafik-raboty-sotrudnika/operation/%D0%98%D0%B7%D0%BC%D0%B5%D0%BD%D0%B8%D1%82%D1%8C%20%D1%80%D0%B0%D1%81%D0%BF%D0%B8%D1%81%D0%B0%D0%BD%D0%B8%D0%B5%20%D1%80%D0%B0%D0%B1%D0%BE%D1%82%D1%8B%20%D1%81%D0%BE%D1%82%D1%80%D1%83%D0%B4%D0%BD%D0%B8%D0%BA%D0%B0) Устаревшее. Изменить расписание работы сотрудника Deprecated

put/schedule/{company\_id}/{staff\_id}

https://api.yclients.com/api/v1/schedule/{company\_id}/{staff\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| staff\_id<br>required | number<br>ID сотрудника |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: \*/\*

|     |     |
| --- | --- |
| date<br>required | string<br>Дата |
| is\_working<br>required | boolean<br>Рабочая дата или нет |
| slots<br>required | object<br>Массив (from, to) промежутков рабочего времени |

### Responses

**201**
Created

# [tag/Daty-dlya-zhurnala](https://developers.yclients.com/ru/\#tag/Daty-dlya-zhurnala) Даты для журнала

Для выбора дат в журнале записи

## [tag/Daty-dlya-zhurnala/operation/Получить список дат для журнала](https://developers.yclients.com/ru/\#tag/Daty-dlya-zhurnala/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%BE%D0%BA%20%D0%B4%D0%B0%D1%82%20%D0%B4%D0%BB%D1%8F%20%D0%B6%D1%83%D1%80%D0%BD%D0%B0%D0%BB%D0%B0) Получить список дат для журнала

get/timetable/dates/{company\_id}/{date}

https://api.yclients.com/api/v1/timetable/dates/{company\_id}/{date}

Даты для журнала представляют из себя массив с датами. (например \["2015-10-26", "2015-10-30"\]).Для получения дат нужно передать дату, относительно которой будут получен список рабочих дат салона/сотрудника.

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| date<br>required | string<br>дата в формате iso8601.<br>Фильтр по дате бронирования (например '2015-09-30') |

##### query Parameters

|     |     |
| --- | --- |
| staff\_id | number<br>ID сотрудника. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
"2024-02-26",\
"2024-03-01",\
"2024-03-02",\
"2024-03-03",\
"2024-03-04",\
"2024-03-05",\
"2024-03-06"],
"meta": [ ]}`

# [tag/Seansy-dlya-zhurnala](https://developers.yclients.com/ru/\#tag/Seansy-dlya-zhurnala) Сеансы для журнала

Для выбора сеансов в журнале записи

## [tag/Seansy-dlya-zhurnala/operation/Получить список сеансов для журнала](https://developers.yclients.com/ru/\#tag/Seansy-dlya-zhurnala/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%BE%D0%BA%20%D1%81%D0%B5%D0%B0%D0%BD%D1%81%D0%BE%D0%B2%20%D0%B4%D0%BB%D1%8F%20%D0%B6%D1%83%D1%80%D0%BD%D0%B0%D0%BB%D0%B0) Получить список сеансов для журнала

get/timetable/seances/{company\_id}/{staff\_id}/{date}

https://api.yclients.com/api/v1/timetable/seances/{company\_id}/{staff\_id}/{date}

Объект сеансы для журнала имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| time | string | Время сеанса (17:30 например) |
| free | boolean | Свободно время или занято |

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| date<br>required | string<br>дата в формате iso8601.<br>Фильтр по дате бронирования (например '2015-09-30') |
| staff\_id<br>required | number<br>ID сотрудника. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| time<br>required | string<br>Время сеанса |
| is\_free<br>required | boolean<br>Свободно время или нет |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"time": "10:00",\
"is_free": true},\
{\
"time": "10:15",\
"is_free": true},\
{\
"time": "10:30",\
"is_free": true},\
{\
"time": "10:45",\
"is_free": true},\
{\
"time": "11:00",\
"is_free": false},\
{\
"time": "11:15",\
"is_free": false},\
{\
"time": "11:30",\
"is_free": false},\
{\
"time": "11:45",\
"is_free": false},\
{\
"time": "12:00",\
"is_free": false},\
{\
"time": "12:15",\
"is_free": false},\
{\
"time": "12:30",\
"is_free": false},\
{\
"time": "12:45",\
"is_free": false},\
{\
"time": "13:00",\
"is_free": true},\
{\
"time": "13:15",\
"is_free": true},\
{\
"time": "13:30",\
"is_free": true},\
{\
"time": "13:45",\
"is_free": true},\
{\
"time": "14:00",\
"is_free": true},\
{\
"time": "14:15",\
"is_free": true},\
{\
"time": "14:30",\
"is_free": true},\
{\
"time": "14:45",\
"is_free": true},\
{\
"time": "15:00",\
"is_free": true},\
{\
"time": "15:15",\
"is_free": true},\
{\
"time": "15:30",\
"is_free": true},\
{\
"time": "15:45",\
"is_free": true},\
{\
"time": "16:00",\
"is_free": true},\
{\
"time": "16:15",\
"is_free": true},\
{\
"time": "16:30",\
"is_free": false},\
{\
"time": "16:45",\
"is_free": false},\
{\
"time": "17:00",\
"is_free": false}],
"meta": [ ]}`

# [tag/Kommentarii](https://developers.yclients.com/ru/\#tag/Kommentarii) Комментарии

Комментарии пользователей к компаниии и сотрудникам

## [tag/Kommentarii/operation/Получить комментарии](https://developers.yclients.com/ru/\#tag/Kommentarii/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D0%BA%D0%BE%D0%BC%D0%BC%D0%B5%D0%BD%D1%82%D0%B0%D1%80%D0%B8%D0%B8) Получить комментарии

get/comments/{company\_id}/

https://api.yclients.com/api/v1/comments/{company\_id}/

Объект комментарии имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | Id комментария |
| salon\_id | number | Id компании |
| type | number | 1 - комментарий к мастеру, 0 - к салону |
| master\_id | number | ID мастера, если type = 1 |
| text | string | Текст комментария |
| date | string | Дата, когда был оставлен комментарий |
| rating | number | Оценка ( от 1 до 5) |
| user\_id | number | Id пользователя, оставившего комментарий |
| user\_name | string | Имя пользователя, оставившего комментарий |
| user\_avatar | string | Аватар пользователя, оставившего комментарий |
| record\_id | number | Идентификатор записи, после которой оставили отзыв (значение будет ненулевым, если отзыв оставлен по ссылке с просьбой оставить отзыв после визита) |

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### query Parameters

|     |     |
| --- | --- |
| start\_date | string<br>дата в формате iso8601.<br>Фильтр по дате с (например '2015-09-30') |
| end\_date | string<br>дата в формате iso8601.<br>Фильтр по дате по (например '2015-09-30') |
| staff\_id | number<br>ID сотрудника |
| rating | number<br>Оценка в рейтинге. Фильтр по отзывам с конкретной оценкой. |
| page | number<br>Номер страницы |
| count | number<br>Количество отзывов на странице |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": "18437",\
"type": "1",\
"master_id": "8864",\
"text": "Отлично!",\
"date": 1438633865,\
"rating": "4",\
"user_id": "157169",\
"user_name": "Виктор Ситников",\
"user_avatar": "/images/no-master.png",\
"record_id": 100001}],
"meta": [ ]}`

## [tag/Kommentarii/operation/Оставить комментарии](https://developers.yclients.com/ru/\#tag/Kommentarii/operation/%D0%9E%D1%81%D1%82%D0%B0%D0%B2%D0%B8%D1%82%D1%8C%20%D0%BA%D0%BE%D0%BC%D0%BC%D0%B5%D0%BD%D1%82%D0%B0%D1%80%D0%B8%D0%B8) Оставить комментарии

post/comments/{company\_id}/{staff\_id}

https://api.yclients.com/api/v1/comments/{company\_id}/{staff\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| staff\_id<br>required | number<br>ID сотрудника, указывать при создании отзыва к сотруднику |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| mark<br>required | number<br>Оценка от 1 до 5 |
| text<br>required | string<br>Текст отзыва |
| name<br>required | string<br>Имя пользователя, которое будет отображено на странице с отзывами |

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Request samples

- Payload

Content type

application/json

Copy

`{
"mark": "4",
"text": "Все очень плохо!",
"name": "Виктор"}`

### Response samples

- 201

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"type": "1",
"master_id": "8864",
"id": "18437",
"text": "Все очень плохо!",
"date": 1464035465,
"rating": "4",
"user_id": "157169",
"user_name": "Виктор",
"user_avatar": "/images/no-master.png"},
"meta": [ ]}`

# [tag/Polzovateli-kompanii](https://developers.yclients.com/ru/\#tag/Polzovateli-kompanii) Пользователи компании

Пользователи, имеющие доступ к управлению определенной компанией

## [tag/Polzovateli-kompanii/operation/Устаревшее. Получить пользователей компании](https://developers.yclients.com/ru/\#tag/Polzovateli-kompanii/operation/%D0%A3%D1%81%D1%82%D0%B0%D1%80%D0%B5%D0%B2%D1%88%D0%B5%D0%B5.%20%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D0%BF%D0%BE%D0%BB%D1%8C%D0%B7%D0%BE%D0%B2%D0%B0%D1%82%D0%B5%D0%BB%D0%B5%D0%B9%20%D0%BA%D0%BE%D0%BC%D0%BF%D0%B0%D0%BD%D0%B8%D0%B8) Устаревшее. Получить пользователей компании Deprecated

get/company\_users/{company\_id}

https://api.yclients.com/api/v1/company\_users/{company\_id}

Объект пользователь компании имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | Id пользователя |
| firstname | string | Имя пользователя |
| login | string | login пользователя для авторизации в системе (для авторизации так же можно в качестве логина поля phone и email) |
| email | string | Почтовый адрес пользователя |
| phone | string | Телефон пользоватя |
| information | string | Информация о пользователе |
| access | object | Объект прав доступа пользоватей к модулям системы |

Объект access имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| timetable\_access | boolean | true - есть доступ к журналу записи, false - нет доступа |
| master\_id | number | 0 - если пользователь может просматривать расписание и записи всех сотрудников, иначе только того сотрудника, ID которого задан |
| position\_id | number | 0 - если пользователь может просматривать расписание и записи всех сотрудников, иначе только ту должность, ID которого задан |
| last\_days\_count | number | 0 - не ограничить доступ к истории расписаний и записям |
| schedule\_edit\_access | boolean | true - есть доступ к графику работы сотрудника в журнале, false - нет доступа |
| timetable\_phones\_access | boolean | true - есть доступ к номеру телефона в журнале записи, false - нет доступа |
| timetable\_transferring\_record\_access | boolean | true - есть доступ к переносу записей, false - нет доступа |
| timetable\_statistics\_access | boolean | true - есть доступ к просмотру статистики, false - нет доступа |
| record\_form\_access | boolean | true - есть доступ к окну записи, false - нет доступа |
| record\_form\_client\_access | boolean | true - есть доступ к данным клиентов, false - нет доступа |
| records\_autocomplete\_access | boolean | true - есть доступ к выпадающему списку с данными о клиентах, false - нет доступа |
| create\_records\_access | boolean | true - есть доступ к созданию записей, false - нет доступа Создавать записи |
| edit\_records\_access | boolean | true - есть доступ к изменение записей, false - нет доступа |
| edit\_records\_attendance\_access | boolean | true - есть доступ к записям со статусом визита "клиент пришел", false - нет доступа |
| records\_services\_cost\_access | boolean | true - есть доступ к изменению стоимости услуг, false - нет доступа |
| records\_services\_discount\_access | boolean | true - есть доступ к изменению скидки на услуги, false - нет доступа |
| record\_edit\_full\_paid\_access | boolean | true - есть доступ к редактированию оплаченной записи, false - нет доступа |
| delete\_records\_access | boolean | true - есть доступ к удалению записи, false - нет доступа |
| delete\_customer\_came\_records\_access | boolean | true - есть доступ к удалению записей со статусом "клиент пришел", false - нет доступа |
| delete\_paid\_records\_access | boolean | true - есть доступ к удалению оплаченных записей, false - нет доступа |
| records\_goods\_access | boolean | true - есть доступ к продажам товаров, false - нет доступа |
| records\_goods\_create\_transaction\_access | boolean | true - есть доступ к созданию товарных транзакций, false - нет доступа |
| records\_goods\_create\_last\_days\_count | number | -1 - есть доступ к созданию товарных транзакций за все время, >= 0 - доступ к созданию товарных транзакций за указанное количество дней прошлое |
| records\_goods\_edit\_transaction\_access | boolean | true - есть доступ к редактированию товарных транзакций, false - нет доступа |
| records\_goods\_edit\_last\_days\_count | number | -1 - есть доступ к редактированию товарных транзакций за все время, >= 0 - доступ к редактированию товарных транзакций за указанное количество дней прошлое |
| records\_goods\_cost\_access | boolean | true - есть доступ к изменению стоимость товаров, false - нет доступа |
| records\_goods\_discount\_access | boolean | true - есть доступ к изменению скидки на товары, false - нет доступа |
| records\_finances\_access | boolean | true - есть доступ к оплате, false - нет доступа |
| records\_finances\_last\_days\_count | number | -1 - есть доступ к проведению оплаты в записях за все время, >= 0 - доступ к проведению оплаты в записях за указанное количество дней прошлое |
| records\_finances\_pay\_from\_deposits\_access | boolean | true - есть доступ к проведению оплаты в записях с личного счета клиента, false - нет доступа |
| records\_group\_id\_access | boolean | true - есть доступ к данным клиентов по сети, false - нет доступа |
| records\_group\_id | number | ID сети к которой есть доступ к данным клиентов |
| finances\_access | boolean | true - есть доступ к финансам, false - нет доступа |
| finances\_accounts\_ids | array | массив ID к выбранным кассам |
| finances\_transactions\_access | boolean | true - есть доступ к просмотру движений средств, false - нет доступа |
| finances\_last\_days\_count | number | -1 - есть доступ к просмотру движений средств за все время, >= 0 - доступ к просмотру движений средств за указанное количество дней прошлое |
| finances\_create\_transactions\_access | boolean | true - есть доступ к созданию транзакций, false - нет доступа |
| finances\_create\_last\_days\_count | number | -1 - есть доступ к созданию транзакций за все время, >= 0 - доступ к созданию транзакций за указанное количество дней прошлое |
| finances\_edit\_transactions\_access | boolean | true - есть доступ к редактированию транзакций, false - нет доступа |
| finances\_edit\_last\_days\_count | number | -1 - есть доступ к редактированию транзакций за все время, >= 0 - доступ к редактированию транзакций за указанное количество дней прошлое |
| finances\_delete\_transactions\_access | boolean | true - есть доступ к удалению транзакций, false - нет доступа |
| finances\_transactions\_excel\_access | boolean | true - есть доступ к выгрузке движений средств в Excel, false - нет доступа |
| finances\_expenses\_ids | array | true - есть доступ к переводам между кассами, false - нет доступа |
| finances\_accounts\_access | boolean | true - есть доступ к счетам и кассам, false - нет доступа |
| finances\_accounts\_banalce\_access | boolean | true - есть доступ к балансу, false - нет доступа |
| finances\_suppliers\_read\_access | boolean | true - есть доступ к контрагентам, false - нет доступа |
| finances\_suppliers\_create\_access | boolean | true - есть доступ к созданию контрагентов, false - нет доступа |
| finances\_suppliers\_update\_access | boolean | true - есть доступ к изменению контрагентов, false - нет доступа |
| finances\_suppliers\_delete\_access | boolean | true - есть доступ к удалению контрагентов, false - нет доступа |
| finances\_suppliers\_excel\_access | boolean | true - есть доступ к выгрузке в Excel, false - нет доступа |
| finances\_expenses\_read\_access | boolean | true - есть доступ к статье платежей, false - нет доступа |
| expenses\_read\_access | boolean | true - есть доступ к статье платежей, false - нет доступа |
| finances\_expenses\_create\_access | boolean | true - есть доступ к созданию статьи платежа, false - нет доступа |
| expenses\_create\_access | boolean | true - есть доступ к созданию статьи платежа, false - нет доступа |
| finances\_expenses\_update\_access | boolean | true - есть доступ к изменению статьи платежа, false - нет доступа |
| expenses\_update\_access | boolean | true - есть доступ к изменению статьи платежа, false - нет доступа |
| finances\_expenses\_delete\_access | boolean | true - есть доступ к удалению статьи платежа, false - нет доступа |
| expenses\_delete\_access | boolean | true - есть доступ к удалению статьи платежа, false - нет доступа |
| finances\_kkm\_transactions\_access | boolean | true - есть доступ к операциям с KKM, false - нет доступа |
| kkm\_transactions\_accounts\_access | boolean | true - есть доступ к операциям с KKM, false - нет доступа |
| finances\_kkm\_settings\_read\_access | boolean | true - есть доступ к настройкам KKM, false - нет доступа |
| kkm\_settings\_reed\_access | boolean | true - есть доступ к настройкам KKM, false - нет доступа |
| finances\_kkm\_settings\_update\_access | boolean | true - есть доступ к изменению KKM, false - нет доступа |
| kkm\_settings\_update\_access | boolean | true - есть доступ к изменению KKM, false - нет доступа |
| finances\_settings\_invoicing\_read\_access | boolean | true - есть доступ к онлайн-оплатам, false - нет доступа |
| finances\_settings\_invoicing\_update\_access | boolean | true - есть доступ к изменению онлайн-оплат, false - нет доступа |
| settings\_invoicing\_update\_access | boolean | true - есть доступ к изменению онлайн-оплат, false - нет доступа |
| finances\_options\_read\_access | boolean | true - есть доступ к настройкам оплаты, false - нет доступа |
| finances\_options\_update\_access | boolean | true - есть доступ к изменению настроек оплаты, false - нет доступа |
| options\_update\_access | boolean | true - есть доступ к изменению настроек оплаты, false - нет доступа |
| finances\_salary\_schemes\_access | boolean | true - есть доступ к схемам расчета заработной платы, false - нет доступа |
| finances\_salary\_calc\_access | boolean | true - есть доступ к расчету заработной платы, false - нет доступа |
| finances\_salary\_not\_limitation\_today\_access | boolean | true - есть доступ к расчету заработной платы, false - доступ к расчету заработной платы за текущий день |
| finances\_payroll\_calculation\_create\_access | boolean | true - есть доступ к начислению заработной платы, false - нет доступа |
| finances\_payroll\_calculation\_create\_not\_limitation\_today\_access | boolean | true - есть доступ к начислению заработной платы, false - доступ к начислению заработной платы за текущий день |
| finances\_salary\_access\_master\_checkbox | boolean | true - есть доступ к расчету заработной платы только конкретного сотрудника, false - полный доступ |
| finances\_salary\_access\_master\_id | number | ID сотрудника к которому есть доступ на расчет заработной платы |
| get\_salary\_access\_master\_id | number | ID сотрудника к которому есть доступ на расчет заработной платы |
| finances\_salary\_master\_not\_limitation\_today\_access | boolean | true - не ограничивать текущим днем, false - доступ только на сегодняшний день |
| finances\_payroll\_calculation\_create\_by\_master\_access | boolean | true - есть доступ к начислению заработной платы по конкретному сотруднику, false - без ограничений |
| calculation\_create\_by\_master\_not\_limitation\_today\_access | boolean | true - есть доступ к начислению заработной платы, false - нет доступа |
| finances\_period\_report\_access | boolean | true - есть доступ к отчету за период, false - нет доступа |
| finances\_period\_report\_excel\_access | boolean | true - есть доступ к выгрузке в Excel отчета за период, false - нет доступа |
| finances\_year\_report\_access | boolean | true - есть доступ к годовому отчету, false - нет доступа |
| finances\_year\_report\_excel\_access | boolean | true - есть доступ к выгрузке в Excel годового отчета, false - нет доступа |
| finances\_print\_check\_access | boolean | true - есть доступ к печати чека, false - нет доступа |
| finances\_z\_report\_access | boolean | true - есть доступ к отчету по кассе за день, false - нет доступа |
| finances\_z\_report\_no\_limit\_today\_access | boolean | true - есть доступ к отчету по кассе, false - доступ к отчету по кассе за текущий день |
| finances\_z\_report\_excel\_access | boolean | true - есть доступ к выгрузке в Excel, false - нет доступа |
| clients\_access | boolean | true - есть доступ к клиентской базе, false - нет доступа |
| clients\_phones\_email\_access | boolean | true - есть доступ к номерам телефонов и email в списке клиентов, false - нет доступа |
| client\_phones\_access | boolean | true - есть доступ к номерам телефонов в списке клиентов, false - нет доступа |
| clients\_card\_phone\_access | boolean | true - есть доступ к телефонам в карточке клиента, false - нет доступа |
| clients\_delete\_access | boolean | true - есть доступ к удалению клиентов, false - нет доступа |
| clients\_excel\_access | boolean | true - есть доступ к выгрузке списка клиентов в Excel, false - нет доступа |
| excel\_access | number | 1 - есть доступ к выгрузке списка клиентов в Excel, 0 - нет доступа |
| client\_comments\_list\_access | boolean | true - есть доступ к просмотру комментарии, false - нет доступа |
| client\_comments\_add\_access | boolean | true - есть доступ к добавлению комментарии, false - нет доступа |
| client\_comments\_own\_edit\_access | boolean | true - есть доступ к изменению/удалению своих комментарии, false - нет доступа |
| client\_comments\_other\_edit\_access | boolean | true - есть доступ к изменению/удалению чужих комментарии, false - нет доступа |
| client\_files\_list\_access | boolean | true - есть доступ к просмотрам и скачиванию файлов, false - нет доступа |
| client\_files\_upload\_access | boolean | true - есть доступ к загрузке файлов, false - нет доступа |
| client\_files\_delete\_access | boolean | true - есть доступ к удалению файлов, false - нет доступа |
| clients\_visit\_master\_id | number | ID мастера по которому можно посмотреть клиентов посещавшие мастера, 0 - без ограничений |
| get\_visit\_master\_id | number | ID мастера по которому можно посмотреть клиентов посещавшие мастера, 0 - без ограничений |
| dashboard\_access | boolean | true - есть доступ к разделу обзор, false - нет доступа |
| dash\_access | boolean | true - есть доступ к разделу сводка, false - нет доступа |
| dash\_phones\_access | boolean | true - есть доступ к показу номера телефонов в сводке, false - нет доступа |
| dash\_records\_access | boolean | true - есть доступ к просмотру списка записей, false - нет доступа |
| dash\_records\_last\_days\_count | number | -1 - есть доступ к просмотру списка записей за все время, >= 0 - доступ к просмотру списка записей за указанное количество дней прошлое |
| dash\_records\_excel\_access | boolean | true - есть доступ к выгрузке списка записей в Excel, false - нет доступа |
| dash\_records\_phones\_access | boolean | true - есть доступ к показу номера телефонов в записях, false - нет доступа |
| dash\_message\_access | boolean | true - есть доступ к просмотру детализаций сообщений, false - нет доступа |
| dash\_message\_excel\_access | boolean | true - есть доступ к выгрузке детализаций сообщений в Excel, false - нет доступа |
| dash\_message\_phones\_access | boolean | true - есть доступ к показу номера телефонов в сообщениях, false - нет доступа |
| dash\_reviews\_access | boolean | true - есть доступ к просмотру отзывов, false - нет доступа |
| dash\_reviews\_delete\_access | boolean | true - есть доступ к удалению отзывов, false - нет доступа |
| dashboard\_calls\_access | boolean | true - есть доступ к разделу звонки, false - нет доступа |
| dashboard\_calls\_excel\_access | boolean | true - есть доступ к выгрузке звонков Excel, false - нет доступа |
| dashboard\_calls\_phones\_access | boolean | true - есть доступ к просмотру номера телефона у клиентов, false - нет доступа |
| notification | boolean | true - есть доступ к Уведомления, false - нет доступа |
| web\_push | boolean | true - есть доступ к показу Push уведомлений о записях в Web-версии, false - нет доступа |
| web\_phone\_push | boolean | true - есть доступ к показу Push уведомлений о звонках в Web-версии, false - нет доступа |
| notification\_sms\_ending\_license | boolean | true - есть доступ к отправки SMS уведомлений о скором окончании лицензии, false - нет доступа |
| notification\_sms\_low\_balance | boolean | true - есть доступ к отправки SMS уведомлений о низком балансе, false - нет доступа |
| notification\_email\_ending\_license | boolean | true - есть доступ к отправки Email уведомлений о скором окончании лицензии, false - нет доступа |
| loyalty\_access | boolean | true - есть доступ к лояльности, false - нет доступа |
| has\_loyalty\_access | boolean | true - есть доступ к лояльности, false - нет доступа |
| loyalty\_cards\_manual\_transactions\_access | boolean | true - есть доступ к ручному пополнению/списанию с карт лояльности, false - нет доступа |
| has\_loyalty\_cards\_manual\_transactions\_access | boolean | true - есть доступ к ручному пополнению/списанию с карт лояльности, false - нет доступа |
| loyalty\_certificate\_and\_abonement\_manual\_transactions\_access | boolean | true - есть доступ к оплате сертификатом и абонементом без кода, false - нет доступа |
| storages\_access | boolean | true - есть доступ к складу, false - нет доступа |
| storages\_ids | boolean | true - есть доступ к выбранным складам, false - нет доступа |
| storages\_transactions\_access | boolean | true - есть доступ к просмотру движений товаров, false - нет доступа |
| storages\_last\_days\_count | number | -1 - есть доступ к просмотру движений товаров за все время, >= 0 - доступ к просмотру движений товаров за указанное количество дней прошлое |
| storages\_move\_goods\_access | boolean | true - есть доступ к перемещение товаров между складами, false - нет доступа |
| storages\_create\_transactions\_access | boolean | true - есть доступ к созданию товарных транзакций, false - нет доступа |
| storages\_create\_last\_days\_count | number | -1 - есть доступ к создание товарных транзакций за все время, >= 0 - доступ к создание товарных транзакций за указанное количество дней прошлое |
| storages\_create\_transactions\_buy\_access | boolean | true - есть доступ к оформлению прихода товаров, false - нет доступа |
| storages\_create\_transactions\_sale\_access | boolean | true - есть доступ к оформлению продаж товаров, false - нет доступа |
| storages\_edit\_transactions\_access | boolean | true - есть доступ к редактированию товарных транзакций, false - нет доступа |
| storages\_edit\_last\_days\_count | number | -1 - есть доступ к редактированию товарных транзакций за все время, >= 0 - доступ к редактированию товарных транзакций за указанное количество дней прошлое |
| storages\_edit\_transactions\_buy\_access | boolean | true - есть доступ к оформлению прихода товаров, false - нет доступа |
| storages\_edit\_transactions\_sale\_access | boolean | true - есть доступ к оформлению продаж товаров, false - нет доступа |
| storages\_delete\_transactions\_access | boolean | true - есть доступ к удалению товарных транзакций, false - нет доступа |
| storages\_transactions\_excel\_access | boolean | true - есть доступ к выгрузке движений товаров в Excel, false - нет доступа |
| storages\_transactions\_types | boolean | true - есть доступ к выгрузке движений товаров в Excel, false - нет доступа |
| storages\_inventory\_access | boolean | true - есть доступ к инвентаризации, false - нет доступа |
| storages\_inventory\_create\_edit\_access | boolean | true - есть доступ к созданию и редактированию инвентаризации, false - нет доступа |
| storages\_inventory\_delete\_access | boolean | true - есть доступ к удалению инвентаризации, false - нет доступа |
| storages\_inventory\_excel\_access | boolean | true - есть доступ к выгрузке инвентаризации в Excel, false - нет доступа |
| storages\_remnants\_report\_access | boolean | true - есть доступ к отчету остатков на складе, false - нет доступа |
| storages\_remnants\_report\_excel\_access | boolean | true - есть доступ к выгрузке остатков в Excel, false - нет доступа |
| storages\_sales\_report\_access | boolean | true - есть доступ к отчету по продажам, false - нет доступа |
| storages\_sales\_report\_excel\_access | boolean | true - есть доступ к выгрузке отчета по продажам в Excel, false - нет доступа |
| storages\_consumable\_report\_access | boolean | true - есть доступ к отчету по списанию расходников, false - нет доступа |
| storages\_consumable\_report\_excel\_access | boolean | true - есть доступ к выгрузке отчета по списанию расходников в Excel, false - нет доступа |
| storages\_write\_off\_report\_access | boolean | true - есть доступ к отчету по списанию товаров, false - нет доступа |
| storages\_write\_off\_report\_excel\_access | boolean | true - есть доступ к выгрузке отчета по списанию товаров в Excel, false - нет доступа |
| storages\_turnover\_report\_access | boolean | true - есть доступ к отчету по оборачиваемости, false - нет доступа |
| storages\_turnover\_report\_excel\_access | boolean | true - есть доступ к выгрузке отчета по оборачиваемости в Excel, false - нет доступа |
| storages\_goods\_crud\_access | boolean | true - есть доступ к управлению товарами, false - нет доступа |
| storages\_goods\_create\_access | boolean | true - есть доступ к созданию товаров, false - нет доступа |
| storages\_goods\_update\_access | boolean | true - есть доступ к изменению товаров, false - нет доступа |
| storages\_goods\_title\_edit\_access | boolean | true - есть доступ к названию, Артикул, Штрих-код, false - нет доступа |
| storages\_goods\_category\_edit\_access | boolean | true - есть доступ к категориям, false - нет доступа |
| storages\_goods\_selling\_price\_edit\_access | boolean | true - есть доступ к ценам продажи, false - нет доступа |
| storages\_goods\_cost\_price\_edit\_access | boolean | true - есть доступ к себестоимости, false - нет доступа |
| storages\_goods\_units\_edit\_access | boolean | true - есть доступ к единицам измерения, false - нет доступа |
| storages\_goods\_critical\_balance\_edit\_access | boolean | true - есть доступ к критичным остаткам, Желаемый остаток, false - нет доступа |
| storages\_goods\_masses\_edit\_access | boolean | true - есть доступ к массе, false - нет доступа |
| storages\_goods\_comment\_edit\_access | boolean | true - есть доступ к комментариям, false - нет доступа |
| storages\_goods\_archive\_access | boolean | true - есть доступ к архивации и восстановлению товаров, false - нет доступа |
| storages\_goods\_delete\_access | boolean | true - есть доступ к удалению товаров, false - нет доступа |
| settings\_access | boolean | true - есть доступ к разделу настройки, false - нет доступа |
| settings\_basis\_access | boolean | true - есть доступ к разделу Основные, false - нет доступа |
| settings\_information\_access | boolean | true - есть доступ к разделу Информация, false - нет доступа |
| users\_access | boolean | true - есть доступ к управлению пользователями, false - нет доступа |
| delete\_users\_access | boolean | true - есть доступ к удалению пользователей, false - нет доступа |
| create\_users\_access | boolean | true - есть доступ к добавлению пользователей, false - нет доступа |
| edit\_users\_access | boolean | true - есть доступ к управлению правами пользователей, false - нет доступа |
| limited\_users\_access | boolean | true - есть доступ к управлению правами в рамках своего набора прав, false - нет доступа |
| settings\_services\_access | boolean | true - есть доступ к разделу Услуги, false - нет доступа |
| settings\_services\_create\_access | boolean | true - есть доступ к созданию услуг, false - нет доступа |
| services\_edit | boolean | true - есть доступ к редактированию услуг, false - нет доступа |
| settings\_services\_edit\_title\_access | boolean | true - есть доступ к названиям услуг и название для онлайн-записи, false - нет доступа |
| settings\_services\_relation\_category\_access | boolean | true - есть доступ к категориям услуги, false - нет доступа |
| settings\_services\_edit\_price\_access | boolean | true - есть доступ к ценам услуг, false - нет доступа |
| settings\_services\_edit\_image\_access | boolean | true - есть доступ к загрузкам и изменениям изображений, false - нет доступа |
| settings\_services\_edit\_online\_seance\_date\_time\_access | boolean | true - есть доступ к отображениям услуг в виджете, false - нет доступа |
| settings\_services\_edit\_online\_pay\_access | boolean | true - есть доступ к онлайн-оплате услуги, false - нет доступа |
| settings\_services\_edit\_services\_related\_resource\_access | boolean | true - есть доступ к ресурсам услуги, false - нет доступа |
| settings\_positions\_read | boolean | true - есть доступ к разделу должности, false - нет доступа |
| settings\_positions\_create | boolean | true - есть доступ к созданию должностей, false - нет доступа |
| settings\_positions\_delete | boolean | true - есть доступ к удалению должностей, false - нет доступа |
| edit\_master\_service\_and\_duration | boolean | true - есть доступ к изменению услуги сотрудников и их длительность, false - нет доступа |
| tech\_card\_edit | boolean | true - есть доступ к изменению технологической карты, false - нет доступа |
| services\_delete | boolean | true - есть доступ к удалению услуг, false - нет доступа |
| settings\_master\_access | boolean | true - есть доступ к разделу Сотрудники, false - нет доступа |
| master\_create | boolean | true - есть доступ к созданию сотрудников, false - нет доступа |
| master\_edit | boolean | true - есть доступ к редактированию сотрудников, false - нет доступа |
| master\_delete | boolean | true - есть доступ к удалению сотрудников, false - нет доступа |
| settings\_master\_dismiss\_access | boolean | true - есть доступ к увольнению сотрудников, false - нет доступа |
| schedule\_edit | boolean | true - есть доступ к редактированию графика работы, false - нет доступа |
| settings\_notifications\_access | boolean | true - есть доступ к разделу Sms уведомления, false - нет доступа |
| settings\_email\_notifications\_access | boolean | true - есть доступ к разделу Email уведомления, false - нет доступа |
| settings\_template\_notifications\_access | boolean | true - есть доступ к разделу Типы уведомлений, false - нет доступа |
| webhook\_read\_access | boolean | true - есть доступ к изменению настроек WebHook, false - нет доступа |
| stat\_access | boolean | true - есть доступ к аналитике, false - нет доступа |
| billing\_access | boolean | true - есть доступ к биллингу (раздел меню баланс), false - нет доступа |
| send\_sms | boolean | true - есть доступ к SMS рассылки клиентам, false - нет доступа |
| auth\_enable\_check\_ip | boolean | true - есть доступ к филиалу только с IP-адресов (v4, v6), false - нет доступа |
| auth\_list\_allowed\_ip | array | список IP адресов |

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 224348,\
"firstname": "прор",\
"login": "79284400000",\
"email": "aser@mail.ru",\
"phone": "79284400000",\
"information": "Test user",\
"access": {\
"stat_access": true,\
"schedule_edit_access": false,\
"client_phones_access": false,\
"clients_access": false,\
"settings_access": false,\
"edit_records_access": false,\
"timetable_access": true,\
"billing_access": false,\
"users_access": false,\
"excel_access": false,\
"finances_access": false,\
"storages_access": false,\
"send_sms": true,\
"master_id": 0}},\
{\
"id": 11,\
"firstname": "Test user",\
"login": "71112222221",\
"email": "moresalonov@yandex.ru",\
"phone": "71112222221",\
"information": "Test user",\
"access": {\
"stat_access": true,\
"schedule_edit_access": true,\
"client_phones_access": true,\
"clients_access": true,\
"settings_access": true,\
"edit_records_access": true,\
"timetable_access": true,\
"billing_access": true,\
"users_access": false,\
"excel_access": true,\
"finances_access": true,\
"storages_access": true,\
"send_sms": true,\
"master_id": 0}}],
"meta": [ ]}`

## [tag/Polzovateli-kompanii/operation/Получить пользователей компании](https://developers.yclients.com/ru/\#tag/Polzovateli-kompanii/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D0%BF%D0%BE%D0%BB%D1%8C%D0%B7%D0%BE%D0%B2%D0%B0%D1%82%D0%B5%D0%BB%D0%B5%D0%B9%20%D0%BA%D0%BE%D0%BC%D0%BF%D0%B0%D0%BD%D0%B8%D0%B8) Получить пользователей компании

get/company/{company\_id}/users

https://api.yclients.com/api/v1/company/{company\_id}/users

Метод позволяет получить пользователей компании.

Объект имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | Id пользователя |
| name | string | Имя пользователя |
| phone | string | Телефон пользоватя |
| email | string | Почтовый адрес пользователя |
| information | string | Информация о пользователе |
| is\_approved | boolean | Принял ли пользователь приглашение к управлению филиалом |
| is\_non\_deletable | boolean | Является ли пользователь неудаляемым |
| user\_role\_slug | string | Роль пользователя в филиале (доступно только для типа бизнеса "Красота") |

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### query Parameters

|     |     |
| --- | --- |
| filter\[is\_approved\] | number<br>Example:filter\[is\_approved\]=1<br>Принял ли пользователь приглашение к управлению филиалом. 1 - принял, 0 - не принял |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | object<br>Метаданные (содержит количество найденных пользователей) |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

### Response samples

- 200
- 401
- 403
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 10,\
"name": "Оксана",\
"phone": "79999990001",\
"email": "test@mail.ru",\
"information": "Менеджер",\
"is_approved": false,\
"is_non_deletable": false,\
"user_role_slug": "manager"},\
{\
"id": 11,\
"name": "Евгений",\
"phone": "79999990002",\
"email": "test@mail.ru",\
"information": "Администратор",\
"is_approved": true,\
"is_non_deletable": true,\
"user_role_slug": "administrator"}],
"meta": {
"count": 2}}`

## [tag/Polzovateli-kompanii/operation/Удалить пользователя в компании](https://developers.yclients.com/ru/\#tag/Polzovateli-kompanii/operation/%D0%A3%D0%B4%D0%B0%D0%BB%D0%B8%D1%82%D1%8C%20%D0%BF%D0%BE%D0%BB%D1%8C%D0%B7%D0%BE%D0%B2%D0%B0%D1%82%D0%B5%D0%BB%D1%8F%20%D0%B2%20%D0%BA%D0%BE%D0%BC%D0%BF%D0%B0%D0%BD%D0%B8%D0%B8) Удалить пользователя в компании

delete/company/{company\_id}/users/{user\_id}

https://api.yclients.com/api/v1/company/{company\_id}/users/{user\_id}

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |
| user\_id<br>required | number<br>ID пользователя |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

### Responses

**204**
No Content

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

### Response samples

- 401
- 403
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": false,
"data": null,
"meta": {
"message": "Необходима авторизация"}}`

# [tag/Kassy](https://developers.yclients.com/ru/\#tag/Kassy) Кассы

## [tag/Kassy/operation/Получить кассы компании](https://developers.yclients.com/ru/\#tag/Kassy/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D0%BA%D0%B0%D1%81%D1%81%D1%8B%20%D0%BA%D0%BE%D0%BC%D0%BF%D0%B0%D0%BD%D0%B8%D0%B8) Получить кассы компании

get/accounts/{company\_id}

https://api.yclients.com/api/v1/accounts/{company\_id}

Объект кассы компании имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | Id кассы |
| title | string | Название |
| type | number | 1 - для безналичных платежей, 0 для наличных |
| comment | string | Описание к кассе |

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 13881,\
"title": "Основная касса",\
"type": 0,\
"comment": "Стоит на ресепшене"},\
{\
"id": 13882,\
"title": "Расчетный счет",\
"type": 1,\
"comment": "Для безналичных расчетов"},\
{\
"id": 21961,\
"title": "Авансы",\
"type": 0,\
"comment": ""}],
"meta": [ ]}`

# [tag/Sklady](https://developers.yclients.com/ru/\#tag/Sklady) Склады

## [tag/Sklady/operation/Получить склады компании](https://developers.yclients.com/ru/\#tag/Sklady/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%BA%D0%BB%D0%B0%D0%B4%D1%8B%20%D0%BA%D0%BE%D0%BC%D0%BF%D0%B0%D0%BD%D0%B8%D0%B8) Получить склады компании

get/storages/{company\_id}

https://api.yclients.com/api/v1/storages/{company\_id}

Объект склада компании имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | ID склада |
| title | string | Название |
| for\_services | number | 1 - если используется для автоматического списания расходников |
| for\_sale | number | 1 - если склад по умолчанию для продажи товаров |
| comment | string | Описание к складу |

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 1,\
"title": "Расходники",\
"for_service": 1,\
"for_sale": 0,\
"comment": "Для учета расходных материалов"},\
{\
"id": 2,\
"title": "Товары",\
"for_service": 0,\
"for_sale": 1,\
"comment": "Для учета продаж в магазине"},\
{\
"id": 23061,\
"title": "Орс",\
"for_service": 0,\
"for_sale": 1,\
"comment": "Нз"}],
"meta": [ ]}`

# [tag/SMS-rassylka](https://developers.yclients.com/ru/\#tag/SMS-rassylka) SMS рассылка

## [tag/SMS-rassylka/operation/Отправить SMS рассылку по списку клиентов](https://developers.yclients.com/ru/\#tag/SMS-rassylka/operation/%D0%9E%D1%82%D0%BF%D1%80%D0%B0%D0%B2%D0%B8%D1%82%D1%8C%20SMS%20%D1%80%D0%B0%D1%81%D1%81%D1%8B%D0%BB%D0%BA%D1%83%20%D0%BF%D0%BE%20%D1%81%D0%BF%D0%B8%D1%81%D0%BA%D1%83%20%D0%BA%D0%BB%D0%B8%D0%B5%D0%BD%D1%82%D0%BE%D0%B2) Отправить SMS рассылку по списку клиентов

post/sms/clients/by\_id/{company\_id}

https://api.yclients.com/api/v1/sms/clients/by\_id/{company\_id}

Объект для создания SMS рассылки имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| client\_ids | array of number | Массив ID клиентов |
| text | string | Текст SMS сообщения |

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| client\_ids | Array of numbers<br>Массив идентификаторов клиентов |
| text | string<br>Текст SMS сообщения |

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | string<br>Имеет значение null |
| meta | object<br>Объект, содержащий сообщение 201 статус-кода |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"client_ids": [\
1,\
2,\
3,\
4,\
5],
"text": "Уважаемые клиенты, поздравляем Вас с тем, что вы наши клиенты! Вам очень повезло!"}`

### Response samples

- 201

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"meta": {
"message": "Accepted"}}`

## [tag/SMS-rassylka/operation/Отправить SMS рассылку по клиентам, подходящим под фильтры](https://developers.yclients.com/ru/\#tag/SMS-rassylka/operation/%D0%9E%D1%82%D0%BF%D1%80%D0%B0%D0%B2%D0%B8%D1%82%D1%8C%20SMS%20%D1%80%D0%B0%D1%81%D1%81%D1%8B%D0%BB%D0%BA%D1%83%20%D0%BF%D0%BE%20%D0%BA%D0%BB%D0%B8%D0%B5%D0%BD%D1%82%D0%B0%D0%BC,%20%D0%BF%D0%BE%D0%B4%D1%85%D0%BE%D0%B4%D1%8F%D1%89%D0%B8%D0%BC%20%D0%BF%D0%BE%D0%B4%20%D1%84%D0%B8%D0%BB%D1%8C%D1%82%D1%80%D1%8B) Отправить SMS рассылку по клиентам, подходящим под фильтры

post/sms/clients/by\_filter/{company\_id}

https://api.yclients.com/api/v1/sms/clients/by\_filter/{company\_id}

Объект для создания SMS рассылки имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| text | string | Текст SMS сообщения |

#### Фильтрация клиентов

- fullname:'Joh' (optional, string) - Имя (часть имени) для фильтрации клиентов
- phone:'7916' (optional, string) - Телефон (часть номера) для фильтрации клиентов
- email:'test@' (optional, string) - Email (часть) для фильтрации клиентов
- card:'5663rt' (optional, string) - Card (часть) для фильтрации клиентов по номеру карты лояльности

Внимание: При отсутствии фильтров SMS рассылка уйдет по всей базе!

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### query Parameters

|     |     |
| --- | --- |
| fullname | string<br>Example:fullname='Joh'<br>Имя (часть имени) для фильтрации клиентов |
| phone | string<br>Example:phone='7916'<br>Телефон (часть номера) для фильтрации клиентов |
| email | string<br>Example:email='test@'<br>Email (часть) для фильтрации клиентов |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| text | string<br>Текст SMS сообщения |

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | string<br>Имеет значение null |
| meta | object<br>Объект, содержащий сообщение 201 статус-кода |

### Request samples

- Payload

Content type

application/json

Copy

`{
"text": "Уважаемые клиенты, поздравляем Вас с тем, что вы наши клиенты! Вам очень повезло!"}`

### Response samples

- 201

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"meta": {
"message": "Accepted"}}`

# [tag/Email-rassylka](https://developers.yclients.com/ru/\#tag/Email-rassylka) Email рассылка

## [tag/Email-rassylka/operation/Отправить Email рассылку по списку клиентов](https://developers.yclients.com/ru/\#tag/Email-rassylka/operation/%D0%9E%D1%82%D0%BF%D1%80%D0%B0%D0%B2%D0%B8%D1%82%D1%8C%20Email%20%D1%80%D0%B0%D1%81%D1%81%D1%8B%D0%BB%D0%BA%D1%83%20%D0%BF%D0%BE%20%D1%81%D0%BF%D0%B8%D1%81%D0%BA%D1%83%20%D0%BA%D0%BB%D0%B8%D0%B5%D0%BD%D1%82%D0%BE%D0%B2) Отправить Email рассылку по списку клиентов

post/email/clients/by\_id/{company\_id}

https://api.yclients.com/api/v1/email/clients/by\_id/{company\_id}

Объект для создания Email рассылки имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| client\_ids | array of number | Массив ID клиентов |
| text | string | Текст Email сообщения |
| subject | string | Тема Email сообщения |

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| client\_ids<br>required | Array of numbers<br>Массив идентификаторов клиентов |
| subject<br>required | string<br>Тема Email сообщения |
| text<br>required | string<br>Текст Email сообщения |

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | string<br>Имеет значение null |
| meta | object<br>Объект, содержащий сообщение 201 статус-кода |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"client_ids": [\
1,\
2,\
3,\
4,\
5],
"subject": "Важно!",
"text": "Уважаемые клиенты, поздравляем Вас с тем, что вы наши клиенты! Вам очень повезло!"}`

### Response samples

- 201

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"meta": {
"message": "Accepted"}}`

## [tag/Email-rassylka/operation/Отправить Email рассылку по клиентам, подходящим под фильтры](https://developers.yclients.com/ru/\#tag/Email-rassylka/operation/%D0%9E%D1%82%D0%BF%D1%80%D0%B0%D0%B2%D0%B8%D1%82%D1%8C%20Email%20%D1%80%D0%B0%D1%81%D1%81%D1%8B%D0%BB%D0%BA%D1%83%20%D0%BF%D0%BE%20%D0%BA%D0%BB%D0%B8%D0%B5%D0%BD%D1%82%D0%B0%D0%BC,%20%D0%BF%D0%BE%D0%B4%D1%85%D0%BE%D0%B4%D1%8F%D1%89%D0%B8%D0%BC%20%D0%BF%D0%BE%D0%B4%20%D1%84%D0%B8%D0%BB%D1%8C%D1%82%D1%80%D1%8B) Отправить Email рассылку по клиентам, подходящим под фильтры

post/email/clients/by\_filter/{company\_id}

https://api.yclients.com/api/v1/email/clients/by\_filter/{company\_id}

Объект для создания Email рассылки имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| text | string | Текст Email сообщения |
| subject | string | Тема Email сообщения |

#### Фильтрация клиентов

- fullname:'Joh' (optional, string) - Имя (часть имени) для фильтрации клиентов
- phone:'7916' (optional, string) - Телефон (часть номера) для фильтрации клиентов
- email:'test@' (optional, string) - Email (часть) для фильтрации клиентов
- card:'5663rt' (optional, string) - Card (часть) для фильтрации клиентов по номеру карты лояльности

Внимание: При отсутствии фильтров Email рассылка уйдет по всей базе!

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### query Parameters

|     |     |
| --- | --- |
| fullname | string<br>Example:fullname='Joh'<br>Имя (часть имени) для фильтрации клиентов |
| phone | string<br>Example:phone='7916'<br>Телефон (часть номера) для фильтрации клиентов |
| email | string<br>Example:email='test@'<br>Email (часть) для фильтрации клиентов |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| subject<br>required | string<br>Тема Email сообщения |
| text<br>required | string<br>Текст Email сообщения |

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | string<br>Имеет значение null |
| meta | object<br>Объект, содержащий сообщение 201 статус-кода |

### Request samples

- Payload

Content type

application/json

Copy

`{
"subject": "Важно!",
"text": "Уважаемые клиенты, поздравляем Вас с тем, что вы наши клиенты! Вам очень повезло!"}`

### Response samples

- 201

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"meta": {
"message": "Accepted"}}`

# [tag/KKM-tranzakcii](https://developers.yclients.com/ru/\#tag/KKM-tranzakcii) ККМ транзакции

## [tag/KKM-tranzakcii/paths/~1kkm_transactions~1{company_id}/get](https://developers.yclients.com/ru/\#tag/KKM-tranzakcii/paths/~1kkm_transactions~1{company_id}/get) Получить транзакции

get/kkm\_transactions/{company\_id}

https://api.yclients.com/api/v1/kkm\_transactions/{company\_id}

Фильтры

| Параметр | Описание |
| --- | --- |
| page | Номер страницы |
| editable\_length | Количество клиентов на странице |
| type | Тип операции |
| status | Статус операции |
| start\_date | Дата начала периода |
| end\_date | Дата окончания периода |

Типы всех операций c ККМ

| Значение | Описание |
| --- | --- |
| 0 | Операция продажи (активна для документа с типом "Визит") |
| 1 | Операция возврата продажи (активна для документа с типом "Визит") |
| 2 | Операция коррекции |
| 4 | Операция открытия смены |
| 5 | Операция закрытия смены |
| 9 | Операция получения статуса ККМ |
| 11 | Операция получения статуса команды ККМ |
| 12 | Операция коррекции |
| 13 | Печать X-отчёта |
| 6 | Внесение наличных |
| 7 | Изъятие наличных |

Статусы всех операций с ККМ

| Значение | Описание |
| --- | --- |
| 0 | Ошибка соединения с KKM |
| 1 | Успешно |
| 2 | Отправлен на печать |
| 3 | Ошибка выполнения |
| 4 | Ошибка проверки статуса |
| 5 | Ожидание готовности KKM |

Типы документов

| Значение | Описание |
| --- | --- |
| 1 | Продажа товара |
| 2 | Оказание услуг |
| 3 | Приход товара |
| 4 | Списание товара |
| 5 | Движение товара |
| 6 | Инвентаризация |
| 7 | Визит |
| 8 | Списание расходников |
| 9 | Пополнение депозита |

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### query Parameters

|     |     |
| --- | --- |
| page | number<br>Example:page=1<br>Номер страницы |
| editable\_length | number<br>Example:editable\_length=25<br>Количество клиентов на странице |
| type | number<br>Example:type=20<br>Тип операции |
| status | number<br>Example:status=6<br>Статус операции |
| start\_date | number<br>Example:start\_date=''<br>Дата начала периода |
| end\_date | number<br>Example:end\_date=''<br>Дата окончания периода |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer access\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | object<br>Метаданные (содержит количество найденных транзакций) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 1059,\
"print_date": 1529975419,\
"printed_count": 1,\
"sum": 10,\
"type": {\
"id": 1,\
"title": "Операция возврата продажи"},\
"status": {\
"id": 3,\
"title": "Ошибка выполнения"},\
"document": {\
"id": 2045,\
"type": 7,\
"type_title": "Визит"},\
"cashier": {\
"id": 746310,\
"name": "Андрей Панов"}}],
"meta": {
"count": 1}}`

## [tag/KKM-tranzakcii/operation/Напечатать чек](https://developers.yclients.com/ru/\#tag/KKM-tranzakcii/operation/%D0%9D%D0%B0%D0%BF%D0%B5%D1%87%D0%B0%D1%82%D0%B0%D1%82%D1%8C%20%D1%87%D0%B5%D0%BA) Напечатать чек

post/kkm\_transactions/{company\_id}/print\_document\_bill

https://api.yclients.com/api/v1/kkm\_transactions/{company\_id}/print\_document\_bill

Типы всех операций c ККМ

| Значение | Описание |
| --- | --- |
| 0 | Операция продажи (активна для документов с типами "Визит" и "Пополнение депозита") |
| 1 | Операция возврата продажи (активна для документов с типами "Визит" и "Пополнение депозита") |
| 2 | Операция коррекции |
| 4 | Операция открытия смены |
| 5 | Операция закрытия смены |
| 9 | Операция получения статуса ККМ |
| 11 | Операция получения статуса команды ККМ |
| 12 | Операция коррекции |
| 13 | Печать X-отчёта |
| 6 | Внесение наличных |
| 7 | Изъятие наличных |

Типы документов

| Значение | Описание |
| --- | --- |
| 1 | Продажа товара |
| 2 | Оказание услуг |
| 3 | Приход товара |
| 4 | Списание товара |
| 5 | Движение товара |
| 6 | Инвентаризация |
| 7 | Визит |
| 8 | Списание расходников |
| 9 | Пополнение депозита |

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID филиала |

##### Request Body schema: \*/\*

|     |     |
| --- | --- |
| document\_id<br>required | number<br>ID документа |
| type<br>required | number<br>тип операции с ККМ (см. таблицу типов всех операций) |
| is\_pos\_enabled | boolean<br>задействовать POS-терминал (по умолчанию false) |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object<br>Массив объектов с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"kkm_type": 0,
"kkm_transactions": [\
{\
"id": 1954,\
"print_date": 1571683616,\
"printed_count": 0,\
"sum": 0,\
"type": {\
"id": 0,\
"title": "Операция продажи"},\
"status": {\
"id": 2,\
"title": "Отправлен на печать"},\
"document": {\
"id": 164,\
"type": 9,\
"type_title": "Пополнение депозита"},\
"cashier": {\
"id": 1138453,\
"name": "Андрей Панов"}}],
"status": 2,
"bill_json": [\
[ ]]},
"meta": [ ]}`

# [tag/Operaciya-prodazhi](https://developers.yclients.com/ru/\#tag/Operaciya-prodazhi) Операция продажи

Объект операции продажи имеет следующую структуру:

| Поле | Тип | Описание |
| --- | --- | --- |
| state | [state](https://developers.yclients.com/ru/#sale-state-type) | Состояние продажи |
| kkm\_state | [kkm\_state](https://developers.yclients.com/ru/#sale-kkm_state-type) | Состояние ККМ |
| payment\_methods | [payment\_method](https://developers.yclients.com/ru/#sale-payment_method-type)\[\] | Доступные методы оплаты |

Тип **state** имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| items | [sale\_item](https://developers.yclients.com/ru/#sale-sale_item-type)\[\] | Продаваемая единица |
| loyalty\_transactions | [loyalty\_transaction](https://developers.yclients.com/ru/#loyalty-transactions)\[\] | Транзакция оплаты с помощью лояльности |
| payment\_transactions | [payment\_transaction](https://developers.yclients.com/ru/#payments-transactions)\[\] | Транзакция оплаты в кассу |

Тип **kkm\_state** имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| last\_operation\_type | [integer](https://developers.yclients.com/ru/#kkm-transaction-types) | [Тип последней операции ККМ](https://developers.yclients.com/ru/#kkm-transaction-types) |
| transactions | [kkm\_transaction](https://developers.yclients.com/ru/#kkm-transactions)\[\] | Транзакция ККМ |

Тип **payment\_method** имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| slug | [slug](https://developers.yclients.com/ru/#sale-payment_method-slugs)(string) | Тип метода оплаты |
| is\_applicable | boolean | Возможно ли применить данный метод |
| applicable\_amount | float | Возможная сумма, приминимая к оплате |
| applicable\_count | int | Возможное количество посещений (в случае абонемента) |
| applicable\_value | float | Применимый бонус (в случае программ лояльности) |
| account\_id | integer(optional) | ID кассы (зависит от [slug](https://developers.yclients.com/ru/#sale-payment_method-slugs)) |
| deposit\_id | integer(optional) | ID депозитного счета (зависит от [slug](https://developers.yclients.com/ru/#sale-payment_method-slugs)) |
| loyalty\_card\_id | integer(optional) | ID карты лояльности (зависит от [slug](https://developers.yclients.com/ru/#sale-payment_method-slugs)) |
| loyalty\_program\_id | integer(optional) | ID программы лояльности (зависит от [slug](https://developers.yclients.com/ru/#sale-payment_method-slugs)) |
| loyalty\_certificate\_id | integer(optional) | ID сертификата (зависит от [slug](https://developers.yclients.com/ru/#sale-payment_method-slugs)) |
| loyalty\_abonement\_id | integer(optional) | ID абонемента (зависит от [slug](https://developers.yclients.com/ru/#sale-payment_method-slugs)) |
| account | [account](https://developers.yclients.com/ru/#accounts)(optional) | Связанная сущность (зависит от [slug](https://developers.yclients.com/ru/#sale-payment_method-slugs)) |
| deposit | object(optional) | Связанная сущность (зависит от [slug](https://developers.yclients.com/ru/#sale-payment_method-slugs)) |
| loyalty\_card | object(optional) | Связанная сущность (зависит от [slug](https://developers.yclients.com/ru/#sale-payment_method-slugs)) |
| loyalty\_program | object(optional) | Связанная сущность (зависит от [slug](https://developers.yclients.com/ru/#sale-payment_method-slugs)) |
| loyalty\_certificate | object(optional) | Связанная сущность (зависит от [slug](https://developers.yclients.com/ru/#sale-payment_method-slugs)) |
| loyalty\_abonement | object(optional) | Связанная сущность (зависит от [slug](https://developers.yclients.com/ru/#sale-payment_method-slugs)) |

Все типы методов оплаты делятся на две группы:

1 - Оплата в кассу:

| Значение | Описание |
| --- | --- |
| account | Оплата в кассу |

2 - Оплата лояльностью:

| Значение | Описание |
| --- | --- |
| deposit | Списание с личного счета |
| loyalty\_program | Использование программы лояльности |
| loyalty\_card | Списание с карты лояльности |
| loyalty\_certificate | Списание с сертификата |
| loyalty\_abonement | Использование абонемента (применяется только к [визиту](https://developers.yclients.com/ru/#visits)) |
| referral\_loyalty\_program | Использование реферальной программы (применяется только к [визиту](https://developers.yclients.com/ru/#visits)) |

Тип **sale\_item** имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | integer | ID продаваемой единицы |
| type | string | Тип (" **service**"/" **good**") |
| title | string | Название |
| amount | integer | Количество |
| default\_cost\_per\_unit | float | Цена за единицу по умолчанию |
| default\_cost\_total | float | Общая цена по умолчанию |
| cost\_to\_pay\_total | float | Цена к оплате |
| client\_discount\_percent | float | Процент скидки |

## [tag/Operaciya-prodazhi/operation/Получение Операции продажи](https://developers.yclients.com/ru/\#tag/Operaciya-prodazhi/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B5%D0%BD%D0%B8%D0%B5%20%D0%9E%D0%BF%D0%B5%D1%80%D0%B0%D1%86%D0%B8%D0%B8%20%D0%BF%D1%80%D0%BE%D0%B4%D0%B0%D0%B6%D0%B8) Получение Операции продажи

get/company/{company\_id}/sale/{document\_id}

https://api.yclients.com/api/v1/company/{company\_id}/sale/{document\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| document\_id<br>required | integer<br>ID документа продажи |
| company\_id<br>required | number<br>ID филиала |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"state": {
"items": [\
{\
"id": 2181520,\
"type": "good",\
"title": "товар 12",\
"amount": 1,\
"default_cost_per_unit": 1300,\
"default_cost_total": 1300,\
"client_discount_percent": 10,\
"cost_to_pay_total": 1170},\
{\
"id": 22017,\
"type": "service",\
"document_id": 8200391,\
"title": "Маникюр",\
"amount": 1,\
"default_cost_per_unit": 500,\
"default_cost_total": 500,\
"client_discount_percent": 10,\
"cost_to_pay_total": 450}],
"loyalty_transactions": [\
{\
"id": 25042,\
"document_id": 8201102,\
"sale_item_id": 2181521,\
"sale_item_type": "good",\
"amount": 9.9,\
"type_id": 11,\
"created_at": 1588265544,\
"deposit_transaction_id": 775,\
"chain": {\
"id": 500,\
"title": "Сеть YC BE"},\
"type": {\
"id": 11,\
"title": "Списание с личного счета"},\
"deposit": {\
"id": 220,\
"balance": 990.1,\
"type": {\
"id": 5,\
"title": "депозит 1"}}},\
{\
"id": 25043,\
"document_id": 8201102,\
"amount": 0.1,\
"type_id": 2,\
"created_at": 1588265721,\
"loyalty_card_id": 185395,\
"loyalty_program_id": 264,\
"chain": {\
"id": 231,\
"title": "Yclients."},\
"type": {\
"id": 2,\
"title": "Начисление по программам лояльности"},\
"loyalty_card": {\
"id": 185395,\
"type_id": 265,\
"number": 23100185395,\
"balance": 50.15,\
"type": {\
"id": 265,\
"type": "Тест шаблонов программ лояльности"},\
"chain": {\
"id": 231,\
"title": "Yclients."}},\
"loyalty_program": {\
"id": 264,\
"title": "CASHBACK BigBro",\
"type_id": 7,\
"is_value_percent": true,\
"type": {\
"id": 7,\
"title": "Накопительный кэшбэк (оплачено)"},\
"chain": {\
"id": 231,\
"title": "Yclients."}}},\
{\
"id": 25050,\
"document_id": 8201102,\
"sale_item_id": 2181521,\
"sale_item_type": "good",\
"amount": 100,\
"type_id": 8,\
"created_at": 1588271563,\
"loyalty_certificate_id": 339,\
"chain": {\
"id": 79,\
"title": "Bank 24"},\
"type": {\
"id": 8,\
"title": "Списание с сертификата"},\
"loyalty_certificate": {\
"id": 339,\
"balance": 0,\
"applicable_balance": 0,\
"type": {\
"id": 20,\
"title": "Тестовый сертификат",\
"is_code_required": true},\
"chain": {\
"id": 231,\
"title": "Yclients."}}}],
"payment_transactions": [\
{\
"id": 6033940,\
"document_id": 8200904,\
"sale_item_id": 2181442,\
"sale_item_type": "good",\
"expense_id": 7,\
"account_id": 90218,\
"amount": 32,\
"account": {\
"id": 90218,\
"title": "Наличная касса по умолчанию",\
"is_cash": true,\
"is_default": true},\
"expense": {\
"id": 7,\
"title": "Продажа товаров"}},\
{\
"id": 6033941,\
"document_id": 8200904,\
"sale_item_id": 2181442,\
"sale_item_type": "good",\
"expense_id": 7,\
"account_id": 90218,\
"amount": 27,\
"account": {\
"id": 90218,\
"title": "Наличная касса",\
"is_cash": true,\
"is_default": false},\
"expense": {\
"id": 7,\
"title": "Продажа товаров"}},\
{\
"id": 6034121,\
"document_id": 8201102,\
"sale_item_id": 2181521,\
"sale_item_type": "good",\
"expense_id": 7,\
"account_id": 23182,\
"amount": 43,\
"account": {\
"id": 23182,\
"title": "Карты - эквайринг по умолчанию",\
"is_cash": false,\
"is_default": true},\
"expense": {\
"id": 7,\
"title": "Продажа товаров"}},\
{\
"id": 6034122,\
"document_id": 8201102,\
"sale_item_id": 2181521,\
"sale_item_type": "good",\
"expense_id": 7,\
"account_id": 23182,\
"amount": 12,\
"account": {\
"id": 23182,\
"title": "Карты - эквайринг",\
"is_cash": false,\
"is_default": false},\
"expense": {\
"id": 7,\
"title": "Продажа товаров"}}]},
"kkm_state": {
"last_operation_type": 1,
"transactions": [\
{\
"id": 2424,\
"document_id": 8200904,\
"print_date": 1587556392,\
"printed_count": 0,\
"sum": 0,\
"type": {\
"id": 0,\
"title": "Операция продажи"},\
"status": {\
"id": 1,\
"title": "Успешно"},\
"document": {\
"id": 7215,\
"type": 1,\
"type_title": "Продажа товара"},\
"cashier": {\
"id": 746310,\
"name": "Андрей Панов"}}]},
"payment_methods": [\
{\
"slug": "account",\
"is_applicable": false,\
"applicable_amount": 1170,\
"applicable_count": 0,\
"applicable_value": 0,\
"account_id": 36785,\
"account": {\
"id": 36785,\
"title": "Касса - безналичные",\
"is_cash": false}},\
{\
"slug": "loyalty_card",\
"is_applicable": true,\
"applicable_amount": 51.65,\
"applicable_count": 0,\
"applicable_value": 0,\
"loyalty_card_id": 19283,\
"loyalty_card": {\
"id": 19283,\
"type_id": 155,\
"number": 31200019283,\
"balance": 51.65,\
"type": {\
"id": 155,\
"type": "скидочная карта"},\
"chain": {\
"id": 312,\
"title": "Trinity group"}}},\
{\
"slug": "loyalty_program",\
"is_applicable": true,\
"applicable_amount": 234,\
"applicable_count": 0,\
"applicable_value": 20,\
"loyalty_card_id": 19283,\
"loyalty_program_id": 183,\
"loyalty_card": {\
"id": 19283,\
"type_id": 155,\
"number": 31200019283,\
"balance": 51.65,\
"type": {\
"id": 155,\
"type": "скидочная карта"},\
"chain": {\
"id": 312,\
"title": "Trinity group"}},\
"loyalty_program": {\
"id": 183,\
"title": "скидка постоянная",\
"type_id": 1,\
"is_value_percent": true,\
"type": {\
"id": 1,\
"title": "Фиксированная скидка"},\
"chain": {\
"id": 312,\
"title": "Trinity group"}}},\
{\
"slug": "loyalty_abonement",\
"is_applicable": false,\
"applicable_amount": 0,\
"applicable_count": 0,\
"applicable_value": 0,\
"loyalty_abonement_id": 27,\
"loyalty_abonement": {\
"id": 27,\
"is_united_balance": false,\
"united_balance": 0,\
"type": {\
"id": 7,\
"title": "абонемент на 5000 QA net",\
"is_code_required": true},\
"chain": {\
"id": 231,\
"title": "Yclients."},\
"balance_container": {\
"links": [\
{\
"count": 5,\
"category": {\
"id": 229680,\
"category_id": 1,\
"title": "Маникюр"}},\
{\
"count": 5,\
"category": {\
"id": 429813,\
"category_id": 429812,\
"title": "1 Занятие"}}]}}},\
{\
"slug": "loyalty_certificate",\
"is_applicable": true,\
"applicable_amount": 1170,\
"applicable_count": 0,\
"applicable_value": 0,\
"loyalty_certificate_id": 338,\
"loyalty_certificate": {\
"id": 338,\
"balance": 10000,\
"applicable_balance": 10000,\
"type": {\
"id": 130,\
"title": "test",\
"is_code_required": true},\
"chain": {\
"id": 231,\
"title": "Yclients."}}},\
{\
"slug": "referral_loyalty_program",\
"is_applicable": false,\
"applicable_amount": 0,\
"applicable_count": 0,\
"applicable_value": 0,\
"loyalty_program_id": 424,\
"loyalty_program": {\
"id": 424,\
"title": "Фиксированная скидка",\
"type_id": 1,\
"is_value_percent": true,\
"type": {\
"id": 1,\
"title": "Фиксированная скидка"},\
"chain": {\
"id": 231,\
"title": "Yclients."}}},\
{\
"slug": "deposit",\
"is_applicable": true,\
"applicable_amount": 9.9,\
"applicable_count": 0,\
"applicable_value": 0,\
"deposit_id": 220,\
"deposit": {\
"id": 220,\
"balance": 1000,\
"type": {\
"id": 5,\
"title": "депозит 1"}}}]},
"meta": [ ]}`

## [tag/Operaciya-prodazhi/operation/Удаление транзакции оплаты в кассу](https://developers.yclients.com/ru/\#tag/Operaciya-prodazhi/operation/%D0%A3%D0%B4%D0%B0%D0%BB%D0%B5%D0%BD%D0%B8%D0%B5%20%D1%82%D1%80%D0%B0%D0%BD%D0%B7%D0%B0%D0%BA%D1%86%D0%B8%D0%B8%20%D0%BE%D0%BF%D0%BB%D0%B0%D1%82%D1%8B%20%D0%B2%20%D0%BA%D0%B0%D1%81%D1%81%D1%83) Удаление транзакции оплаты в кассу

delete/company/{company\_id}/sale/{document\_id}/payment/payment\_transaction/{payment\_transaction\_id}

https://api.yclients.com/api/v1/company/{company\_id}/sale/{document\_id}/payment/payment\_transaction/{payment\_transaction\_id}

В качестве ответа возвращается информация об [Операции продажи](https://developers.yclients.com/ru/#sale-operation)

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| document\_id<br>required | integer<br>ID документа продажи |
| payment\_transaction\_id<br>required | integer<br>ID транзакции |
| company\_id<br>required | number<br>ID филиала |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"state": {
"items": [\
{\
"id": 2181520,\
"type": "good",\
"title": "товар 12",\
"amount": 1,\
"default_cost_per_unit": 1300,\
"default_cost_total": 1300,\
"client_discount_percent": 10,\
"cost_to_pay_total": 1170},\
{\
"id": 22017,\
"type": "service",\
"document_id": 8200391,\
"title": "Маникюр",\
"amount": 1,\
"default_cost_per_unit": 500,\
"default_cost_total": 500,\
"client_discount_percent": 10,\
"cost_to_pay_total": 450}],
"loyalty_transactions": [\
{\
"id": 25042,\
"document_id": 8201102,\
"sale_item_id": 2181521,\
"sale_item_type": "good",\
"amount": 9.9,\
"type_id": 11,\
"created_at": 1588265544,\
"deposit_transaction_id": 775,\
"chain": {\
"id": 500,\
"title": "Сеть YC BE"},\
"type": {\
"id": 11,\
"title": "Списание с личного счета"},\
"deposit": {\
"id": 220,\
"balance": 990.1,\
"type": {\
"id": 5,\
"title": "депозит 1"}}},\
{\
"id": 25043,\
"document_id": 8201102,\
"amount": 0.1,\
"type_id": 2,\
"created_at": 1588265721,\
"loyalty_card_id": 185395,\
"loyalty_program_id": 264,\
"chain": {\
"id": 231,\
"title": "Yclients."},\
"type": {\
"id": 2,\
"title": "Начисление по программам лояльности"},\
"loyalty_card": {\
"id": 185395,\
"type_id": 265,\
"number": 23100185395,\
"balance": 50.15,\
"type": {\
"id": 265,\
"type": "Тест шаблонов программ лояльности"},\
"chain": {\
"id": 231,\
"title": "Yclients."}},\
"loyalty_program": {\
"id": 264,\
"title": "CASHBACK BigBro",\
"type_id": 7,\
"is_value_percent": true,\
"type": {\
"id": 7,\
"title": "Накопительный кэшбэк (оплачено)"},\
"chain": {\
"id": 231,\
"title": "Yclients."}}},\
{\
"id": 25050,\
"document_id": 8201102,\
"sale_item_id": 2181521,\
"sale_item_type": "good",\
"amount": 100,\
"type_id": 8,\
"created_at": 1588271563,\
"loyalty_certificate_id": 339,\
"chain": {\
"id": 79,\
"title": "Bank 24"},\
"type": {\
"id": 8,\
"title": "Списание с сертификата"},\
"loyalty_certificate": {\
"id": 339,\
"balance": 0,\
"applicable_balance": 0,\
"type": {\
"id": 20,\
"title": "Тестовый сертификат",\
"is_code_required": true}}}],
"payment_transactions": [\
{\
"id": 6033940,\
"document_id": 8200904,\
"sale_item_id": 2181442,\
"sale_item_type": "good",\
"expense_id": 7,\
"account_id": 90218,\
"amount": 32,\
"account": {\
"id": 90218,\
"title": "Наличная касса по умолчанию",\
"is_cash": true,\
"is_default": true},\
"expense": {\
"id": 7,\
"title": "Продажа товаров"}},\
{\
"id": 6033941,\
"document_id": 8200904,\
"sale_item_id": 2181442,\
"sale_item_type": "good",\
"expense_id": 7,\
"account_id": 90218,\
"amount": 27,\
"account": {\
"id": 90218,\
"title": "Наличная касса",\
"is_cash": true,\
"is_default": false},\
"expense": {\
"id": 7,\
"title": "Продажа товаров"}},\
{\
"id": 6034121,\
"document_id": 8201102,\
"sale_item_id": 2181521,\
"sale_item_type": "good",\
"expense_id": 7,\
"account_id": 23182,\
"amount": 43,\
"account": {\
"id": 23182,\
"title": "Карты - эквайринг по умолчанию",\
"is_cash": false,\
"is_default": true},\
"expense": {\
"id": 7,\
"title": "Продажа товаров"}},\
{\
"id": 6034122,\
"document_id": 8201102,\
"sale_item_id": 2181521,\
"sale_item_type": "good",\
"expense_id": 7,\
"account_id": 23182,\
"amount": 12,\
"account": {\
"id": 23182,\
"title": "Карты - эквайринг",\
"is_cash": false,\
"is_default": false},\
"expense": {\
"id": 7,\
"title": "Продажа товаров"}}]},
"kkm_state": {
"last_operation_type": 1,
"transactions": [\
{\
"id": 2424,\
"document_id": 8200904,\
"print_date": 1587556392,\
"printed_count": 0,\
"sum": 0,\
"type": {\
"id": 0,\
"title": "Операция продажи"},\
"status": {\
"id": 1,\
"title": "Успешно"},\
"document": {\
"id": 7215,\
"type": 1,\
"type_title": "Продажа товара"},\
"cashier": {\
"id": 746310,\
"name": "Андрей Панов"}}]},
"payment_methods": [\
{\
"slug": "account",\
"is_applicable": false,\
"applicable_amount": 1170,\
"applicable_count": 0,\
"applicable_value": 0,\
"account_id": 36785,\
"account": {\
"id": 36785,\
"title": "Касса - безналичные",\
"is_cash": false}},\
{\
"slug": "loyalty_card",\
"is_applicable": true,\
"applicable_amount": 51.65,\
"applicable_count": 0,\
"applicable_value": 0,\
"loyalty_card_id": 19283,\
"loyalty_card": {\
"id": 19283,\
"type_id": 155,\
"number": 31200019283,\
"balance": 51.65,\
"type": {\
"id": 155,\
"type": "скидочная карта"},\
"chain": {\
"id": 312,\
"title": "Trinity group"}}},\
{\
"slug": "loyalty_program",\
"is_applicable": true,\
"applicable_amount": 234,\
"applicable_count": 0,\
"applicable_value": 20,\
"loyalty_card_id": 19283,\
"loyalty_program_id": 183,\
"loyalty_card": {\
"id": 19283,\
"type_id": 155,\
"number": 31200019283,\
"balance": 51.65,\
"type": {\
"id": 155,\
"type": "скидочная карта"},\
"chain": {\
"id": 312,\
"title": "Trinity group"}},\
"loyalty_program": {\
"id": 183,\
"title": "скидка постоянная",\
"type_id": 1,\
"is_value_percent": true,\
"type": {\
"id": 1,\
"title": "Фиксированная скидка"},\
"chain": {\
"id": 312,\
"title": "Trinity group"}}},\
{\
"slug": "loyalty_abonement",\
"is_applicable": false,\
"applicable_amount": 0,\
"applicable_count": 0,\
"applicable_value": 0,\
"loyalty_abonement_id": 27,\
"loyalty_abonement": {\
"id": 27,\
"is_united_balance": false,\
"united_balance": 0,\
"type": {\
"id": 7,\
"title": "абонемент на 5000 QA net",\
"is_code_required": true},\
"balance_container": {\
"links": [\
{\
"count": 5,\
"category": {\
"id": 229680,\
"category_id": 1,\
"title": "Маникюр"}},\
{\
"count": 5,\
"category": {\
"id": 429813,\
"category_id": 429812,\
"title": "1 Занятие"}}]}}},\
{\
"slug": "loyalty_certificate",\
"is_applicable": true,\
"applicable_amount": 1170,\
"applicable_count": 0,\
"applicable_value": 0,\
"loyalty_certificate_id": 338,\
"loyalty_certificate": {\
"id": 338,\
"balance": 10000,\
"applicable_balance": 10000,\
"type": {\
"id": 130,\
"title": "test",\
"is_code_required": true}}},\
{\
"slug": "referral_loyalty_program",\
"is_applicable": false,\
"applicable_amount": 0,\
"applicable_count": 0,\
"applicable_value": 0,\
"loyalty_program_id": 424,\
"loyalty_program": {\
"id": 424,\
"title": "Фиксированная скидка",\
"type_id": 1,\
"is_value_percent": true,\
"type": {\
"id": 1,\
"title": "Фиксированная скидка"},\
"chain": {\
"id": 231,\
"title": "Yclients."}}},\
{\
"slug": "deposit",\
"is_applicable": true,\
"applicable_amount": 9.9,\
"applicable_count": 0,\
"applicable_value": 0,\
"deposit_id": 220,\
"deposit": {\
"id": 220,\
"balance": 1000,\
"type": {\
"id": 5,\
"title": "депозит 1"}}}]},
"meta": [ ]}`

## [tag/Operaciya-prodazhi/operation/Удаление транзакции оплаты лояльностью](https://developers.yclients.com/ru/\#tag/Operaciya-prodazhi/operation/%D0%A3%D0%B4%D0%B0%D0%BB%D0%B5%D0%BD%D0%B8%D0%B5%20%D1%82%D1%80%D0%B0%D0%BD%D0%B7%D0%B0%D0%BA%D1%86%D0%B8%D0%B8%20%D0%BE%D0%BF%D0%BB%D0%B0%D1%82%D1%8B%20%D0%BB%D0%BE%D1%8F%D0%BB%D1%8C%D0%BD%D0%BE%D1%81%D1%82%D1%8C%D1%8E) Удаление транзакции оплаты лояльностью

delete/company/{company\_id}/sale/{document\_id}/payment/loyalty\_transaction/{payment\_transaction\_id}

https://api.yclients.com/api/v1/company/{company\_id}/sale/{document\_id}/payment/loyalty\_transaction/{payment\_transaction\_id}

В качестве ответа возвращается информация об [Операции продажи](https://developers.yclients.com/ru/#sale-operation)

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| document\_id<br>required | integer<br>ID документа продажи |
| payment\_transaction\_id<br>required | integer<br>ID транзакции |
| company\_id<br>required | number<br>ID филиала |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"state": {
"items": [\
{\
"id": 2181520,\
"type": "good",\
"title": "товар 12",\
"amount": 1,\
"default_cost_per_unit": 1300,\
"default_cost_total": 1300,\
"client_discount_percent": 10,\
"cost_to_pay_total": 1170},\
{\
"id": 22017,\
"type": "service",\
"document_id": 8200391,\
"title": "Маникюр",\
"amount": 1,\
"default_cost_per_unit": 500,\
"default_cost_total": 500,\
"client_discount_percent": 10,\
"cost_to_pay_total": 450}],
"loyalty_transactions": [\
{\
"id": 25042,\
"document_id": 8201102,\
"sale_item_id": 2181521,\
"sale_item_type": "good",\
"amount": 9.9,\
"type_id": 11,\
"created_at": 1588265544,\
"deposit_transaction_id": 775,\
"chain": {\
"id": 500,\
"title": "Сеть YC BE"},\
"type": {\
"id": 11,\
"title": "Списание с личного счета"},\
"deposit": {\
"id": 220,\
"balance": 990.1,\
"type": {\
"id": 5,\
"title": "депозит 1"}}},\
{\
"id": 25043,\
"document_id": 8201102,\
"amount": 0.1,\
"type_id": 2,\
"created_at": 1588265721,\
"loyalty_card_id": 185395,\
"loyalty_program_id": 264,\
"chain": {\
"id": 231,\
"title": "Yclients."},\
"type": {\
"id": 2,\
"title": "Начисление по программам лояльности"},\
"loyalty_card": {\
"id": 185395,\
"type_id": 265,\
"number": 23100185395,\
"balance": 50.15,\
"type": {\
"id": 265,\
"type": "Тест шаблонов программ лояльности"},\
"chain": {\
"id": 231,\
"title": "Yclients."}},\
"loyalty_program": {\
"id": 264,\
"title": "CASHBACK BigBro",\
"type_id": 7,\
"is_value_percent": true,\
"type": {\
"id": 7,\
"title": "Накопительный кэшбэк (оплачено)"},\
"chain": {\
"id": 231,\
"title": "Yclients."}}},\
{\
"id": 25050,\
"document_id": 8201102,\
"sale_item_id": 2181521,\
"sale_item_type": "good",\
"amount": 100,\
"type_id": 8,\
"created_at": 1588271563,\
"loyalty_certificate_id": 339,\
"chain": {\
"id": 79,\
"title": "Bank 24"},\
"type": {\
"id": 8,\
"title": "Списание с сертификата"},\
"loyalty_certificate": {\
"id": 339,\
"balance": 0,\
"applicable_balance": 0,\
"type": {\
"id": 20,\
"title": "Тестовый сертификат",\
"is_code_required": true}}}],
"payment_transactions": [\
{\
"id": 6033940,\
"document_id": 8200904,\
"sale_item_id": 2181442,\
"sale_item_type": "good",\
"expense_id": 7,\
"account_id": 90218,\
"amount": 32,\
"account": {\
"id": 90218,\
"title": "Наличная касса по умолчанию",\
"is_cash": true,\
"is_default": true},\
"expense": {\
"id": 7,\
"title": "Продажа товаров"}},\
{\
"id": 6033941,\
"document_id": 8200904,\
"sale_item_id": 2181442,\
"sale_item_type": "good",\
"expense_id": 7,\
"account_id": 90218,\
"amount": 27,\
"account": {\
"id": 90218,\
"title": "Наличная касса",\
"is_cash": true,\
"is_default": false},\
"expense": {\
"id": 7,\
"title": "Продажа товаров"}},\
{\
"id": 6034121,\
"document_id": 8201102,\
"sale_item_id": 2181521,\
"sale_item_type": "good",\
"expense_id": 7,\
"account_id": 23182,\
"amount": 43,\
"account": {\
"id": 23182,\
"title": "Карты - эквайринг по умолчанию",\
"is_cash": false,\
"is_default": true},\
"expense": {\
"id": 7,\
"title": "Продажа товаров"}},\
{\
"id": 6034122,\
"document_id": 8201102,\
"sale_item_id": 2181521,\
"sale_item_type": "good",\
"expense_id": 7,\
"account_id": 23182,\
"amount": 12,\
"account": {\
"id": 23182,\
"title": "Карты - эквайринг",\
"is_cash": false,\
"is_default": false},\
"expense": {\
"id": 7,\
"title": "Продажа товаров"}}]},
"kkm_state": {
"last_operation_type": 1,
"transactions": [\
{\
"id": 2424,\
"document_id": 8200904,\
"print_date": 1587556392,\
"printed_count": 0,\
"sum": 0,\
"type": {\
"id": 0,\
"title": "Операция продажи"},\
"status": {\
"id": 1,\
"title": "Успешно"},\
"document": {\
"id": 7215,\
"type": 1,\
"type_title": "Продажа товара"},\
"cashier": {\
"id": 746310,\
"name": "Андрей Панов"}}]},
"payment_methods": [\
{\
"slug": "account",\
"is_applicable": false,\
"applicable_amount": 1170,\
"applicable_count": 0,\
"applicable_value": 0,\
"account_id": 36785,\
"account": {\
"id": 36785,\
"title": "Касса - безналичные",\
"is_cash": false}},\
{\
"slug": "loyalty_card",\
"is_applicable": true,\
"applicable_amount": 51.65,\
"applicable_count": 0,\
"applicable_value": 0,\
"loyalty_card_id": 19283,\
"loyalty_card": {\
"id": 19283,\
"type_id": 155,\
"number": 31200019283,\
"balance": 51.65,\
"type": {\
"id": 155,\
"type": "скидочная карта"},\
"chain": {\
"id": 312,\
"title": "Trinity group"}}},\
{\
"slug": "loyalty_program",\
"is_applicable": true,\
"applicable_amount": 234,\
"applicable_count": 0,\
"applicable_value": 20,\
"loyalty_card_id": 19283,\
"loyalty_program_id": 183,\
"loyalty_card": {\
"id": 19283,\
"type_id": 155,\
"number": 31200019283,\
"balance": 51.65,\
"type": {\
"id": 155,\
"type": "скидочная карта"},\
"chain": {\
"id": 312,\
"title": "Trinity group"}},\
"loyalty_program": {\
"id": 183,\
"title": "скидка постоянная",\
"type_id": 1,\
"is_value_percent": true,\
"type": {\
"id": 1,\
"title": "Фиксированная скидка"},\
"chain": {\
"id": 312,\
"title": "Trinity group"}}},\
{\
"slug": "loyalty_abonement",\
"is_applicable": false,\
"applicable_amount": 0,\
"applicable_count": 0,\
"applicable_value": 0,\
"loyalty_abonement_id": 27,\
"loyalty_abonement": {\
"id": 27,\
"is_united_balance": false,\
"united_balance": 0,\
"type": {\
"id": 7,\
"title": "абонемент на 5000 QA net",\
"is_code_required": true},\
"balance_container": {\
"links": [\
{\
"count": 5,\
"category": {\
"id": 229680,\
"category_id": 1,\
"title": "Маникюр"}},\
{\
"count": 5,\
"category": {\
"id": 429813,\
"category_id": 429812,\
"title": "1 Занятие"}}]}}},\
{\
"slug": "loyalty_certificate",\
"is_applicable": true,\
"applicable_amount": 1170,\
"applicable_count": 0,\
"applicable_value": 0,\
"loyalty_certificate_id": 338,\
"loyalty_certificate": {\
"id": 338,\
"balance": 10000,\
"applicable_balance": 10000,\
"type": {\
"id": 130,\
"title": "test",\
"is_code_required": true}}},\
{\
"slug": "referral_loyalty_program",\
"is_applicable": false,\
"applicable_amount": 0,\
"applicable_count": 0,\
"applicable_value": 0,\
"loyalty_program_id": 424,\
"loyalty_program": {\
"id": 424,\
"title": "Фиксированная скидка",\
"type_id": 1,\
"is_value_percent": true,\
"type": {\
"id": 1,\
"title": "Фиксированная скидка"},\
"chain": {\
"id": 231,\
"title": "Yclients."}}},\
{\
"slug": "deposit",\
"is_applicable": true,\
"applicable_amount": 9.9,\
"applicable_count": 0,\
"applicable_value": 0,\
"deposit_id": 220,\
"deposit": {\
"id": 220,\
"balance": 1000,\
"type": {\
"id": 5,\
"title": "депозит 1"}}}]},
"meta": [ ]}`

## [tag/Operaciya-prodazhi/operation/Оплата лояльностью (различными методами)](https://developers.yclients.com/ru/\#tag/Operaciya-prodazhi/operation/%D0%9E%D0%BF%D0%BB%D0%B0%D1%82%D0%B0%20%D0%BB%D0%BE%D1%8F%D0%BB%D1%8C%D0%BD%D0%BE%D1%81%D1%82%D1%8C%D1%8E%20(%D1%80%D0%B0%D0%B7%D0%BB%D0%B8%D1%87%D0%BD%D1%8B%D0%BC%D0%B8%20%D0%BC%D0%B5%D1%82%D0%BE%D0%B4%D0%B0%D0%BC%D0%B8)) Оплата в кассу и лояльностью (различными методами)

post/company/{company\_id}/sale/{document\_id}/payment

https://api.yclients.com/api/v1/company/{company\_id}/sale/{document\_id}/payment

В качестве ответа возвращается информация об [Операции продажи](https://developers.yclients.com/ru/#sale-operation)

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| document\_id<br>required | number<br>Идентификатор документа |
| company\_id<br>required | number<br>ID филиала |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

1. В случае оплаты сертификатом, если у пользователя нет права "Оплата сертификатом и абонементом без кода" в теле запроса также необходимо передать пераметр "number" (string), содержащий код сертификата.
2. В случае оплаты абонементом, если у пользователя нет права "Оплата сертификатом и абонементом без кода" в теле запроса также необходимо передать пераметр "number" (string), содержащий код абонемента.

Any of

Оплата в кассуОплата при помощи личного счета \- депозитаОплата при помощи сертификатаОплата при помощи абонемента \- работает только для визита.Оплата при помощи реферальной программы \- работает только для визитаОплата при помощи карты лояльностиОплата при помощи программы лояльности

|     |     |
| --- | --- |
| payment | object<br>Объект, содержащий метод оплаты |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Request samples

- Payload

Content type

application/json

Example

Оплата в кассуОплата при помощи личного счета \- депозитаОплата при помощи сертификатаОплата при помощи абонемента \- работает только для визита.Оплата при помощи реферальной программы \- работает только для визитаОплата при помощи карты лояльностиОплата при помощи программы лояльностиОплата в кассу

Copy
Expand all  Collapse all

`{
"payment": {
"method": {
"slug": "account",
"account_id": 90218},
"amount": 123}}`

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"state": {
"items": [\
{\
"id": 2181520,\
"type": "good",\
"title": "товар 12",\
"amount": 1,\
"default_cost_per_unit": 1300,\
"default_cost_total": 1300,\
"client_discount_percent": 10,\
"cost_to_pay_total": 1170},\
{\
"id": 22017,\
"type": "service",\
"document_id": 8200391,\
"title": "Маникюр",\
"amount": 1,\
"default_cost_per_unit": 500,\
"default_cost_total": 500,\
"client_discount_percent": 10,\
"cost_to_pay_total": 450}],
"loyalty_transactions": [\
{\
"id": 25042,\
"document_id": 8201102,\
"sale_item_id": 2181521,\
"sale_item_type": "good",\
"amount": 9.9,\
"type_id": 11,\
"created_at": 1588265544,\
"deposit_transaction_id": 775,\
"chain": {\
"id": 500,\
"title": "Сеть YC BE"},\
"type": {\
"id": 11,\
"title": "Списание с личного счета"},\
"deposit": {\
"id": 220,\
"balance": 990.1,\
"type": {\
"id": 5,\
"title": "депозит 1"}}},\
{\
"id": 25043,\
"document_id": 8201102,\
"amount": 0.1,\
"type_id": 2,\
"created_at": 1588265721,\
"loyalty_card_id": 185395,\
"loyalty_program_id": 264,\
"chain": {\
"id": 231,\
"title": "Yclients."},\
"type": {\
"id": 2,\
"title": "Начисление по программам лояльности"},\
"loyalty_card": {\
"id": 185395,\
"type_id": 265,\
"number": 23100185395,\
"balance": 50.15,\
"type": {\
"id": 265,\
"type": "Тест шаблонов программ лояльности"},\
"chain": {\
"id": 231,\
"title": "Yclients."}},\
"loyalty_program": {\
"id": 264,\
"title": "CASHBACK BigBro",\
"type_id": 7,\
"is_value_percent": true,\
"type": {\
"id": 7,\
"title": "Накопительный кэшбэк (оплачено)"},\
"chain": {\
"id": 231,\
"title": "Yclients."}}},\
{\
"id": 25050,\
"document_id": 8201102,\
"sale_item_id": 2181521,\
"sale_item_type": "good",\
"amount": 100,\
"type_id": 8,\
"created_at": 1588271563,\
"loyalty_certificate_id": 339,\
"chain": {\
"id": 79,\
"title": "Bank 24"},\
"type": {\
"id": 8,\
"title": "Списание с сертификата"},\
"loyalty_certificate": {\
"id": 339,\
"balance": 0,\
"applicable_balance": 0,\
"type": {\
"id": 20,\
"title": "Тестовый сертификат",\
"is_code_required": true},\
"chain": {\
"id": 231,\
"title": "Yclients."}}}],
"payment_transactions": [\
{\
"id": 6033940,\
"document_id": 8200904,\
"sale_item_id": 2181442,\
"sale_item_type": "good",\
"expense_id": 7,\
"account_id": 90218,\
"amount": 32,\
"account": {\
"id": 90218,\
"title": "Наличная касса по умолчанию",\
"is_cash": true,\
"is_default": true},\
"expense": {\
"id": 7,\
"title": "Продажа товаров"}},\
{\
"id": 6033941,\
"document_id": 8200904,\
"sale_item_id": 2181442,\
"sale_item_type": "good",\
"expense_id": 7,\
"account_id": 90218,\
"amount": 27,\
"account": {\
"id": 90218,\
"title": "Наличная касса",\
"is_cash": true,\
"is_default": false},\
"expense": {\
"id": 7,\
"title": "Продажа товаров"}},\
{\
"id": 6034121,\
"document_id": 8201102,\
"sale_item_id": 2181521,\
"sale_item_type": "good",\
"expense_id": 7,\
"account_id": 23182,\
"amount": 43,\
"account": {\
"id": 23182,\
"title": "Карты - эквайринг по умолчанию",\
"is_cash": false,\
"is_default": true},\
"expense": {\
"id": 7,\
"title": "Продажа товаров"}},\
{\
"id": 6034122,\
"document_id": 8201102,\
"sale_item_id": 2181521,\
"sale_item_type": "good",\
"expense_id": 7,\
"account_id": 23182,\
"amount": 12,\
"account": {\
"id": 23182,\
"title": "Карты - эквайринг",\
"is_cash": false,\
"is_default": false},\
"expense": {\
"id": 7,\
"title": "Продажа товаров"}}]},
"kkm_state": {
"last_operation_type": 1,
"transactions": [\
{\
"id": 2424,\
"document_id": 8200904,\
"print_date": 1587556392,\
"printed_count": 0,\
"sum": 0,\
"type": {\
"id": 0,\
"title": "Операция продажи"},\
"status": {\
"id": 1,\
"title": "Успешно"},\
"document": {\
"id": 7215,\
"type": 1,\
"type_title": "Продажа товара"},\
"cashier": {\
"id": 746310,\
"name": "Андрей Панов"}}]},
"payment_methods": [\
{\
"slug": "account",\
"is_applicable": false,\
"applicable_amount": 1170,\
"applicable_count": 0,\
"applicable_value": 0,\
"account_id": 36785,\
"account": {\
"id": 36785,\
"title": "Касса - безналичные",\
"is_cash": false}},\
{\
"slug": "loyalty_card",\
"is_applicable": true,\
"applicable_amount": 51.65,\
"applicable_count": 0,\
"applicable_value": 0,\
"loyalty_card_id": 19283,\
"loyalty_card": {\
"id": 19283,\
"type_id": 155,\
"number": 31200019283,\
"balance": 51.65,\
"type": {\
"id": 155,\
"type": "скидочная карта"},\
"chain": {\
"id": 312,\
"title": "Trinity group"}}},\
{\
"slug": "loyalty_program",\
"is_applicable": true,\
"applicable_amount": 234,\
"applicable_count": 0,\
"applicable_value": 20,\
"loyalty_card_id": 19283,\
"loyalty_program_id": 183,\
"loyalty_card": {\
"id": 19283,\
"type_id": 155,\
"number": 31200019283,\
"balance": 51.65,\
"type": {\
"id": 155,\
"type": "скидочная карта"},\
"chain": {\
"id": 312,\
"title": "Trinity group"}},\
"loyalty_program": {\
"id": 183,\
"title": "скидка постоянная",\
"type_id": 1,\
"is_value_percent": true,\
"type": {\
"id": 1,\
"title": "Фиксированная скидка"},\
"chain": {\
"id": 312,\
"title": "Trinity group"}}},\
{\
"slug": "loyalty_abonement",\
"is_applicable": false,\
"applicable_amount": 0,\
"applicable_count": 0,\
"applicable_value": 0,\
"loyalty_abonement_id": 27,\
"loyalty_abonement": {\
"id": 27,\
"is_united_balance": false,\
"united_balance": 0,\
"type": {\
"id": 7,\
"title": "абонемент на 5000 QA net",\
"is_code_required": true},\
"chain": {\
"id": 231,\
"title": "Yclients."},\
"balance_container": {\
"links": [\
{\
"count": 5,\
"category": {\
"id": 229680,\
"category_id": 1,\
"title": "Маникюр"}},\
{\
"count": 5,\
"category": {\
"id": 429813,\
"category_id": 429812,\
"title": "1 Занятие"}}]}}},\
{\
"slug": "loyalty_certificate",\
"is_applicable": true,\
"applicable_amount": 1170,\
"applicable_count": 0,\
"applicable_value": 0,\
"loyalty_certificate_id": 338,\
"loyalty_certificate": {\
"id": 338,\
"balance": 10000,\
"applicable_balance": 10000,\
"type": {\
"id": 130,\
"title": "test",\
"is_code_required": true},\
"chain": {\
"id": 231,\
"title": "Yclients."}}},\
{\
"slug": "referral_loyalty_program",\
"is_applicable": false,\
"applicable_amount": 0,\
"applicable_count": 0,\
"applicable_value": 0,\
"loyalty_program_id": 424,\
"loyalty_program": {\
"id": 424,\
"title": "Фиксированная скидка",\
"type_id": 1,\
"is_value_percent": true,\
"type": {\
"id": 1,\
"title": "Фиксированная скидка"},\
"chain": {\
"id": 231,\
"title": "Yclients."}}},\
{\
"slug": "deposit",\
"is_applicable": true,\
"applicable_amount": 9.9,\
"applicable_count": 0,\
"applicable_value": 0,\
"deposit_id": 220,\
"deposit": {\
"id": 220,\
"balance": 1000,\
"type": {\
"id": 5,\
"title": "депозит 1"}}}]},
"meta": [ ]}`

# [tag/Finansovye-tranzakcii](https://developers.yclients.com/ru/\#tag/Finansovye-tranzakcii) Финансовые транзакции

Объект транзакции имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | ID транзакции |
| document\_id | number | ID документа |
| expense | expense | Тип платежа |
| date | string | Дата создания транзакции |
| amount | float | Сумма транзакции |
| comment | string | Комментарий |
| master | master | Сотрудник |
| supplier | supplier | Контрагент |
| account | account | Касса |
| client | client | Клиент |

Объекты expense, master, account, supplier имеют следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | ID |
| title | string | Описание |

Объект client имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | ID |
| name | string | Имя |
| phone | string | Номер телефона |

## [tag/Finansovye-tranzakcii/operation/Получить транзакции](https://developers.yclients.com/ru/\#tag/Finansovye-tranzakcii/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%82%D1%80%D0%B0%D0%BD%D0%B7%D0%B0%D0%BA%D1%86%D0%B8%D0%B8) Получить транзакции

get/transactions/{company\_id}

https://api.yclients.com/api/v1/transactions/{company\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### query Parameters

|     |     |
| --- | --- |
| page | number<br>Example:page=1<br>Номер страницы |
| count | number<br>Example:count=50<br>Количество клиентов на странице |
| account\_id | number<br>Example:account\_id=0<br>ID кассы |
| supplier\_id | number<br>Example:supplier\_id=0<br>ID контрагента |
| client\_id | number<br>Example:client\_id=0<br>ID клиента |
| user\_id | number<br>Example:user\_id=0<br>ID пользователя |
| master\_id | number<br>Example:master\_id=0<br>ID сотрудника |
| type | number<br>Example:type=0<br>тип транзакции |
| real\_money | number<br>Example:real\_money=0<br>транзакция реальными деньгами |
| deleted | number<br>Example:deleted=0<br>была ли удалена транзакция |
| start\_date | number<br>Example:start\_date=2023-01-01<br>дата начала периода |
| end\_date | number<br>Example:end\_date=2023-03-01<br>дата окончания периода |
| balance\_is | number<br>Example:balance\_is=0<br>0 - любой баланс, 1 - положительный, 2 - оттрицательный |
| document\_id | number<br>Example:document\_id=0<br>идентификатор документа |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": "4815162342",\
"document_id": 22256641,\
"expense": {\
"id": "5",\
"title": "Оказание услуг"},\
"date": "2016-04-13T15:34:31+0400",\
"amount": "1000.00",\
"comment": "Comment",\
"master": {\
"id": "1926",\
"title": "Суини Тодд"},\
"supplier": {\
"id": "1968",\
"title": "George"},\
"account": {\
"id": "23182",\
"title": "Карты"},\
"client": {\
"id": "481516",\
"name": "John Turk",\
"phone": 79876543210},\
"last_change_date": "2020-02-01T12:00:00+0400",\
"record_id": 308786662,\
"visit_id": 262551993,\
"sold_item_id": 7134634,\
"sold_item_type": "service"}],
"meta": [ ]}`

## [tag/Finansovye-tranzakcii/paths/~1timetable~1transactions~1{company_id}/get](https://developers.yclients.com/ru/\#tag/Finansovye-tranzakcii/paths/~1timetable~1transactions~1{company_id}/get) Получение транзакций по ID визита или записи

get/timetable/transactions/{company\_id}

https://api.yclients.com/api/v1/timetable/transactions/{company\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### query Parameters

|     |     |
| --- | --- |
| record\_id | number<br>Example:record\_id=0<br>ID записи |
| visit\_id | number<br>Example:visit\_id=0<br>ID визита |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": "4815162342",\
"document_id": 22256641,\
"expense": {\
"id": "5",\
"title": "Оказание услуг"},\
"date": "2016-04-13T15:34:31+0400",\
"amount": "1000.00",\
"comment": "Comment",\
"master": {\
"id": "1926",\
"title": "Суини Тодд"},\
"supplier": {\
"id": "1968",\
"title": "George"},\
"account": {\
"id": "23182",\
"title": "Карты"},\
"client": {\
"id": "481516",\
"name": "John Turk",\
"phone": 79876543210},\
"last_change_date": "2020-02-01T12:00:00+0400",\
"record_id": 308786662,\
"visit_id": 262551993,\
"sold_item_id": 7134634,\
"sold_item_type": "service"}],
"meta": [ ]}`

## [tag/Finansovye-tranzakcii/operation/Создание финансовой транзакции](https://developers.yclients.com/ru/\#tag/Finansovye-tranzakcii/operation/%D0%A1%D0%BE%D0%B7%D0%B4%D0%B0%D0%BD%D0%B8%D0%B5%20%D1%84%D0%B8%D0%BD%D0%B0%D0%BD%D1%81%D0%BE%D0%B2%D0%BE%D0%B9%20%D1%82%D1%80%D0%B0%D0%BD%D0%B7%D0%B0%D0%BA%D1%86%D0%B8%D0%B8) Создание финансовой транзакции

post/finance\_transactions/{company\_id}

https://api.yclients.com/api/v1/finance\_transactions/{company\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| expense\_id | number<br>Статья платежа |
| amount | number<float><br>Сумма транзакции |
| account\_id | number<br>Идентификатор кассы |
| client\_id | number<br>Идентификатор клиента |
| supplier\_id | number<br>Идентификатор контрагента |
| master\_id | number<br>Идентификатор сотрудника |
| comment | number<br>Комментарий |
| date | string<date-time><br>Дата создания транзакции |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Request samples

- Payload

Content type

application/json

Copy

`{
"expense_id": 2640,
"amount": 100,
"account_id": 39105,
"client_id": 4240788,
"supplier_id": 0,
"master_id": 0,
"comment": "Transaction comment",
"date": "2023-01-01 10:00:00"}`

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 277016617,
"document_id": 0,
"date": "2023-01-01 10:00:00",
"type_id": 5,
"expense_id": 5,
"account_id": 774020,
"amount": 100,
"client_id": 51520012,
"master_id": 921395,
"supplier_id": 0,
"comment": "Transaction comment",
"item_id": 0,
"target_type_id": 0,
"record_id": 0,
"goods_transaction_id": 0,
"expense": {
"id": 5,
"title": "Оказание услуг"},
"account": {
"id": 774020,
"title": "Архив касса",
"is_cash": true,
"is_default": false},
"client": {
"id": 51520012,
"name": "Суинни Тодд",
"phone": "79161001010",
"email": "m.todd@yclients.todd"},
"master": {
"id": 921395,
"name": "Валерия"},
"supplier": [ ]},
"meta": [ ]}`

## [tag/Finansovye-tranzakcii/operation/Получение финансовой транзакции](https://developers.yclients.com/ru/\#tag/Finansovye-tranzakcii/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B5%D0%BD%D0%B8%D0%B5%20%D1%84%D0%B8%D0%BD%D0%B0%D0%BD%D1%81%D0%BE%D0%B2%D0%BE%D0%B9%20%D1%82%D1%80%D0%B0%D0%BD%D0%B7%D0%B0%D0%BA%D1%86%D0%B8%D0%B8) Получение финансовой транзакции

get/finance\_transactions/{company\_id}/{transaction\_id}

https://api.yclients.com/api/v1/finance\_transactions/{company\_id}/{transaction\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| transaction\_id<br>required | number<br>ID транзакции |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": "4815162342",\
"document_id": 22256641,\
"expense": {\
"id": "5",\
"title": "Оказание услуг"},\
"date": "2016-04-13 15:34:31",\
"amount": "1000.00",\
"comment": "Comment",\
"master": {\
"id": "1926",\
"title": "Суини Тодд"},\
"supplier": {\
"id": "1968",\
"title": "George"},\
"account": {\
"id": "23182",\
"title": "Карты"},\
"client": {\
"id": "481516",\
"name": "John Turk",\
"phone": 79876543210},\
"last_change_date": "2020-02-01T12:00:00+0400",\
"record_id": 308786662,\
"visit_id": 262551993,\
"sold_item_id": 7134634,\
"sold_item_type": "service"}],
"meta": [ ]}`

## [tag/Finansovye-tranzakcii/operation/Обновление финансовой транзакции](https://developers.yclients.com/ru/\#tag/Finansovye-tranzakcii/operation/%D0%9E%D0%B1%D0%BD%D0%BE%D0%B2%D0%BB%D0%B5%D0%BD%D0%B8%D0%B5%20%D1%84%D0%B8%D0%BD%D0%B0%D0%BD%D1%81%D0%BE%D0%B2%D0%BE%D0%B9%20%D1%82%D1%80%D0%B0%D0%BD%D0%B7%D0%B0%D0%BA%D1%86%D0%B8%D0%B8) Обновление финансовой транзакции

put/finance\_transactions/{company\_id}/{transaction\_id}

https://api.yclients.com/api/v1/finance\_transactions/{company\_id}/{transaction\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| transaction\_id<br>required | number<br>ID транзакции |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: \*/\*

|     |     |
| --- | --- |
| expense\_id | number<br>Статья платежа |
| amount | number<float><br>Сумма транзакции |
| account\_id | number<br>Идентификатор кассы |
| client\_id | number<br>Идентификатор клиента |
| supplier\_id | number<br>Идентификатор контрагента |
| master\_id | number<br>Идентификатор сотрудника |
| comment | number<br>Комментарий |
| date | string<date-time><br>Дата создания транзакции |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": "4815162342",\
"document_id": 22256641,\
"expense": {\
"id": "5",\
"title": "Оказание услуг"},\
"date": "2016-04-13 15:34:31",\
"amount": "1000.00",\
"comment": "Comment",\
"master": {\
"id": "1926",\
"title": "Суини Тодд"},\
"supplier": {\
"id": "1968",\
"title": "George"},\
"account": {\
"id": "23182",\
"title": "Карты"},\
"client": {\
"id": "481516",\
"name": "John Turk",\
"phone": 79876543210},\
"last_change_date": "2020-02-01T12:00:00+0400",\
"record_id": 308786662,\
"visit_id": 262551993,\
"sold_item_id": 7134634,\
"sold_item_type": "service"}],
"meta": [ ]}`

## [tag/Finansovye-tranzakcii/paths/~1finance_transactions~1{company_id}~1{transaction_id}/delete](https://developers.yclients.com/ru/\#tag/Finansovye-tranzakcii/paths/~1finance_transactions~1{company_id}~1{transaction_id}/delete) Удаление транзакции

delete/finance\_transactions/{company\_id}/{transaction\_id}

https://api.yclients.com/api/v1/finance\_transactions/{company\_id}/{transaction\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| transaction\_id<br>required | number<br>ID транзакции |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**202**
Accepted

# [tag/Integraciya-s-setevoj-telefoniej](https://developers.yclients.com/ru/\#tag/Integraciya-s-setevoj-telefoniej) Интеграция с сетевой телефонией

## [tag/Integraciya-s-setevoj-telefoniej/paths/~1voip~1integration/post](https://developers.yclients.com/ru/\#tag/Integraciya-s-setevoj-telefoniej/paths/~1voip~1integration/post) События телефонии

post/voip/integration

https://api.yclients.com/api/v1/voip/integration

#### Подключить интеграцию

Для использования api и активации доступа к настройкам в пользовательском интерфейсе необходимо активировать интеграцию, отправив запрос "Подключить интеграцию". После успешного подключения, в сетевом интерфейсе пользователя будет открыт доступ в раздел с настройками маршрутизации.

#### Отключить интеграция

Для отключения интеграции можно воспользоваться методом "Отключить интеграцию". После отключения интеграции закрывается доступ в раздел настроек пользовательского интерфейса, обработка запросов "Уведомление о звонке" и "Сохранение информации о звонке" не производится.

#### Уведомление о звонке

Для отображения уведомлений о входящем звонке используется метод "Уведомление о звонке", в параметрах указыватеся тип звонка ("incoming", "outgoing", "internal"), но на текущий момент уведомления отображаются только для значения "incoming". Уведомления отображаются для пользователей, определенных на основе настроек маршрутизации. При одновременном указании параметров "user" и "diversion" приоритетным при поиске маршрутов является "user".

#### Сохранение информации о звонке

Сохранение информации о звонке автоматически происходит в сетевую историю и в историю компаний сети в соответствии с настройками маршрутизации звонка.

##### Authorizations:

_bearer_

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token |

##### Request Body schema: application/json

Тела запросов

Any of

Подключить интеграциюОтключить интеграциюСохранение информации о звонкеУведомление о звонке

|     |     |
| --- | --- |
| command<br>required | string<br>Slug операции 'setup' |
| type<br>required | string<br>Тип операции, в данном случае 'enable' |
| crm\_token<br>required | string<br>CRM-токен из раздела Телефония-Интеграция в сети клиента |

### Responses

**202**
Accepted

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успшности выполнения (true) |
| data | string<br>Содержит null |
| meta | object<br>Метаданные (содержить сообщение "Accepted") |

### Request samples

- Payload

Content type

application/json

Example

Подключить интеграциюОтключить интеграциюСохранение информации о звонкеУведомление о звонкеПодключить интеграцию

Copy

`{
"command": "setup",
"type": "enable",
"crm_token": "7cf262d6-1656-43f9-86ac-2826bdc125d2"}`

### Response samples

- 202

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"meta": {
"message": "Accepted"}}`

## [tag/Integraciya-s-setevoj-telefoniej/operation/voip.integration.calls_list](https://developers.yclients.com/ru/\#tag/Integraciya-s-setevoj-telefoniej/operation/voip.integration.calls_list) Получить список звонков филиала

get/voip/integration/calls

https://api.yclients.com/api/v1/voip/integration/calls

Данный эндпойнт предназначен для получения списка звонков в филиале с учетом фильтров и с пагинацией

##### Authorizations:

_BearerPartnerUser_

##### Request Body schema: application/json

|     |     |
| --- | --- |
| salon\_id<br>required | number<br>Идентификатор салона. |
| date\_from<br>required | string<br>Дата начала выборки. |
| date\_to<br>required | string<br>Дата окончания выборки. |
| phone | string<br>Номер телефона. |
| types | Array of strings<br>ItemsEnum:"incoming""outgoing""internal"<br>Набор типов звонка |
| statuses | Array of strings<br>ItemsEnum:"success""missed""cancel""busy""notallowed""notavailable""notfound"<br>Набор статусов |
| page | number<br>Номер страницы |
| limit | number<= 1000<br>Количество элементов на странице |

### Responses

**200**
Список звонков

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | Array of objects<br>Список звонков |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Не передан токен партнера.

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Нет доступа (необходимо право на просмотр "Обзор \- Звонки").

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"salon_id": 615243,
"date_from": "2023-01-01",
"date_to": "2023-02-01",
"phone": "79111234567",
"types": [\
"incoming",\
"internal"],
"statuses": [\
"success",\
"cancel"],
"page": 1,
"limit": 25}`

### Response samples

- 200
- 401
- 403

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 8923525,\
"client_id": 51342134,\
"caller_phone": "791112345678",\
"record_link": "https://records.gravitel.ru/somelink.mp3",\
"duration": 244,\
"status": "success",\
"type": "outgoing",\
"call_date": "2023-01-17 23:52:21"},\
{\
"id": 66795308,\
"client_id": 0,\
"caller_phone": "791112345678",\
"record_link": "",\
"duration": 0,\
"status": "missed",\
"type": "incoming",\
"call_date": "2023-01-17 12:31:12"}]}`

# [tag/Loyalnost](https://developers.yclients.com/ru/\#tag/Loyalnost) Лояльность

Сгенерированный объект кода имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| code | string | Сгенерированный код |

## [tag/Loyalnost/paths/~1chain~1{chain_id}~1loyalty~1notification_message_templates~1programs/get](https://developers.yclients.com/ru/\#tag/Loyalnost/paths/~1chain~1{chain_id}~1loyalty~1notification_message_templates~1programs/get) Получить список шаблонов уведомлений лояльности

get/chain/{chain\_id}/loyalty/notification\_message\_templates/programs

https://api.yclients.com/api/v1/chain/{chain\_id}/loyalty/notification\_message\_templates/programs

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| chain\_id<br>required | integer<br>Идентификатор сети |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

Array

|     |     |
| --- | --- |
| id | integer<int32><br>Идентификатор шаблона |
| type | string<br>Enum:"big""mid""small""custom"<br>Вариант шаблона |
| body | string<br>Текст шаблона |
| message\_type | string<br>Enum:"loyalty\_discount\_expiration""loyalty\_cashback\_expiration""loyalty\_discount\_increased""loyalty\_discount\_decreased""loyalty\_card\_created""loyalty\_card\_withdraw""loyalty\_withdraw\_cancelled""loyalty\_card\_manual""loyalty\_card\_manual\_withdraw""loyalty\_card\_cashback""loyalty\_card\_cashback\_cancelled""loyalty\_card\_income""loyalty\_discount\_changed""loyalty\_cashback\_changed""loyalty\_settings\_abonement\_notification"<br>Тип сообщения |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`[\
{\
"id": 12,\
"type": "small",\
"message_type": "loyalty_discount_expiration",\
"body": "Ваша скидка завтра сгорает"}]`

## [tag/Loyalnost/paths/~1chain~1{chain_id}~1loyalty~1programs~1/post](https://developers.yclients.com/ru/\#tag/Loyalnost/paths/~1chain~1{chain_id}~1loyalty~1programs~1/post) Создать акцию в сети

post/chain/{chain\_id}/loyalty/programs/

https://api.yclients.com/api/v1/chain/{chain\_id}/loyalty/programs/

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| chain\_id<br>required | integer<br>Идентификатор сети |

##### query Parameters

|     |     |
| --- | --- |
| include | string<br>Enum:"applicable\_items""rules""companies""loyalty\_card\_types""on\_changed\_notification\_template""on\_expiration\_notification\_template"<br>Включить в ответ дополнительные ресурсы |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>applization/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| title<br>required | string<br>Название акции |
| type<br>required | string<br>Enum:"discount\_static""discount\_accumulative\_visits""discount\_accumulative\_sold""discount\_accumulative\_paid""cashback\_static\_sold""cashback\_static\_paid""cashback\_accumulative\_paid""cashback\_accumulative\_sold""cashback\_accumulative\_paid\_visits""cashback\_accumulative\_sold\_visits""cashback\_sold\_visits""cashback\_paid\_visits""package\_discount"<br>Тип акции |
| service\_item\_type<br>required | string<br>Enum:"any\_allowed""not\_allowed""custom\_allowed"<br>Тип применения к услугам |
| good\_item\_type<br>required | string<br>Enum:"any\_allowed""not\_allowed""custom\_allowed"<br>Тип применения к товарам |
| value\_unit<br>required | string<br>Enum:"percent""amount"<br>Единица измерения бонуса или скидки (процент, фиксированная сумма) |
| usage\_limit | integer<int32><br>Ограничение по количеству применений (только для кэшбека) |
| visit\_multiplicity | integer<int32><br>Кратность применения по визитам (только для кэшбека) |
| sold\_items\_multiplicity | integer<int32><br>Сколько услуг нужно оплатить, чтобы получить скидку на акционные услуги (только для типа акции "Скидка по условию") |
| expiration\_timeout | integer<int32><br>Срок сгорания бонусов или скидки |
| expiration\_timeout\_unit | string<br>Enum:"day""week""month""year"<br>Единица измерения срока сгорания бонусов или скидки |
| expiration\_notification\_timeout | integer<int32><br>За сколько дней до наступления срока сгорания бонуса или скидки необходимо отправить клиенту уведомление |
| params\_source\_type | string<br>Enum:"loyalty\_card""active\_companies""chain"<br>Откуда брать историю клиента для расчета размера бонуса или скидки (для накпоительных акций или скидки по условию) |
| history\_start\_date | string<date><br>С какой даты учитывать историю клиента для расчета размера бонуса или скидки (для накопительных акций или скидки по условию) |
| loyalty\_card\_type\_ids | Array of integers<int32>\[ items <int32 > \]<br>Идентификаторы типов карт, для которых действует акция |
| on\_changed\_notification\_template | object (Root Type for LoyaltyNotificationMessageTemplateRequest) <br>Тело запроса на привязку шаблона уведомления лояльности |
| on\_expiration\_notification\_template | object (Root Type for LoyaltyNotificationMessageTemplateRequest) <br>Тело запроса на привязку шаблона уведомления лояльности |
| rules<br>required | Array of objects (Root Type for LoyaltyProgramRuleRequest) <br>Правила для определения значения бонуса или скидки (допустимо только одно правило для фиксированных акций) |
| company\_ids<br>required | Array of integers<int32>\[ items <int32 > \]<br>Идентификаторы филиалов, в которых действует акция |
| allowed\_service\_ids | Array of integers<int32>\[ items <int32 > \]<br>Идентификаторы услуг и категорий услуг (если задан тип применения для некоторых услуг) |
| allowed\_good\_ids | Array of integers<int32>\[ items <int32 > \]<br>Идентификаторы товаров (если задан тип применения для некоторых товаров) |
| allowed\_good\_category\_ids | Array of integers<int32>\[ items <int32 > \]<br>Идентификаторы категорий товаров (если задан тип применения для некоторых товаров) |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| id | integer<int32><br>Идетификатор акции |
| title | string<br>Название акции |
| type | string<br>Enum:"discount\_static""discount\_accumulative\_visits""discount\_accumulative\_sold""discount\_accumulative\_paid""cashback\_static\_sold""cashback\_static\_paid""cashback\_accumulative\_paid""cashback\_accumulative\_sold""cashback\_accumulative\_paid\_visits""cashback\_accumulative\_sold\_visits""cashback\_sold\_visits""cashback\_paid\_visits""package\_discount"<br>Тип акции |
| service\_item\_type | string<br>Enum:"any\_allowed""not\_allowed""custom\_allowed"<br>Тип применения к услугам |
| good\_item\_type | string<br>Enum:"any\_allowed""not\_allowed""custom\_allowed"<br>Тип применения к товарам |
| value\_unit | string<br>Enum:"percent""amount"<br>Единица измерения бонуса или скидки (процент, фиксированная сумма) |
| usage\_limit | integer<int32><br>Ограничение по количеству применений (только для кэшбека) |
| visit\_multiplicity | integer<int32><br>Кратность применения по визитам (только для кэшбека) |
| sold\_items\_multiplicity | integer<int32><br>Сколько услуг нужно оплатить, чтобы получить скидку на акционные услуги (только для типа акции "Скидка по условию") |
| expiration\_timeout | integer<int32><br>Срок сгорания бонусов или скидки |
| expiration\_timeout\_unit | string<br>Enum:"day""week""month""year"<br>Единица измерения срока сгорания бонусов или скидки |
| expiration\_notification\_timeout | integer<int32><br>За сколько дней до наступления срока сгорания бонуса или скидки необходимо отправить клиенту уведомление |
| params\_source\_type | string<br>Enum:"loyalty\_card""active\_companies""chain"<br>Откуда брать историю клиента для расчета размера бонуса или скидки (для накпоительных акций или скидки по условию) |
| history\_start\_date | string<date><br>С какой даты учитывать историю клиента для расчета размера бонуса или скидки (для накопительных акций или скидки по условию) |
| on\_changed\_notification\_template\_id | integer<int32><br>Идентификатор шаблона уведомления при изменении бонуса или скидки |
| on\_expiration\_notification\_template\_id | integer<int32><br>Идентификатор шаблона уведомления при сгорании бонуса или скидки |
| loyalty\_card\_types | Array of objects (Root Type for LoyaltyCardType) <br>Тип карт, для которых действует акция (по запросу) |
| on\_changed\_notification\_template | object (Root Type for LoyaltyNotificationMessageTemplate) <br>Шаблон уведомлений лояльности |
| on\_expiration\_notification\_template | object (Root Type for LoyaltyNotificationMessageTemplate) <br>Шаблон уведомлений лояльности |
| rules | Array of objects (Root Type for LoyaltyProgramRule) <br>Правила для определения значения бонуса или скидки (допустимо только одно правило для фиксированных акций) (по запросу) |
| companies | Array of objects (Company) <br>Филиалы, в которых действует акция (по запросу) |
| applicable\_items | Array of objects (Root Type for LoyaltyEntityAttendanceItem) <br>Связанные сущности для выборочного применения акции (по запросу) |

**422**
Ошибка валидации

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"title": "Накопительная скидка для некоторых услуг и не для товаров",
"type": "discount_accumulative_paid",
"service_item_type": "custom_allowed",
"good_item_type": "not_allowed",
"allowed_service_ids": [\
53,\
92],
"allowed_good_ids": [ ],
"allowed_good_category_ids": [ ],
"value_unit": "percent",
"usage_limit": 0,
"visit_multiplicity": 0,
"sold_items_multiplicity": 0,
"expiration_timeout": 6,
"expiration_timeout_unit": "month",
"expiration_notification_timeout": 7,
"params_source_type": "chain",
"history_start_date": 1516147200,
"loyalty_card_type_ids": [\
51,\
29],
"on_changed_notification_template": {
"type": "custom",
"body": "Ваша скидка изменилась"},
"on_expiration_notification_template": {
"type": "big"},
"rules": [\
{\
"parameter": 10,\
"value": 2.5,\
"service_id": 0},\
{\
"parameter": 30,\
"value": 7.5,\
"service_id": 0}],
"company_ids": [\
49]}`

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"id": 34,
"title": "Накопительная скидка для некоторых услуг и не для товаров",
"type": "discount_accumulative_paid",
"service_item_type": "custom_allowed",
"good_item_type": "not_allowed",
"value_unit": "percent",
"usage_limit": 0,
"visit_multiplicity": 0,
"sold_items_multiplicity": 0,
"expiration_timeout": 6,
"expiration_timeout_unit": "month",
"expiration_notification_timeout": 7,
"params_source_type": "chain",
"history_start_date": 1516147200,
"on_changed_notification_template_id": 55,
"on_expiration_notification_template_id": 84,
"loyalty_card_types": [\
{\
"id": 51,\
"title": "Тип карты 1"},\
{\
"id": 29,\
"title": "Тип карты 2"}],
"on_changed_notification_template": {
"id": 55,
"type": "custom",
"body": "Ваша скидка изменилась",
"message_type": "loyalty_discount_changed"},
"on_expiration_notification_template": {
"id": 84,
"type": "big",
"body": "Подробный текст о сгорании скидки",
"message_type": "loyalty_discount_expiration"},
"rules": [\
{\
"id": 94,\
"parameter": 10,\
"value": 2.5,\
"loyalty_program_id": 34,\
"loyalty_type_id": 3,\
"service_id": 0},\
{\
"id": 74,\
"parameter": 30,\
"value": 7.5,\
"loyalty_program_id": 34,\
"loyalty_type_id": 3,\
"service_id": 0}],
"companies": [\
{\
"id": 49,\
"title": "Филиал",\
"country": "Россия",\
"country_id": 5,\
"city": "Москва",\
"city_id": 83,\
"phone": "7912345678",\
"timezone": "Europe/Moscow",\
"address": "Адрес филиала",\
"coordinate_lat": 77.32,\
"coordinate_lng": 18.63}],
"applicable_items": [\
{\
"id": 53,\
"title": "Категория услуг 1",\
"is_service": true,\
"is_category": true},\
{\
"id": 92,\
"title": "Категория услуг 2",\
"is_service": true,\
"is_category": true}]}`

## [tag/Loyalnost/paths/~1chain~1{chain_id}~1loyalty~1programs~1{loyalty_program_id}/get](https://developers.yclients.com/ru/\#tag/Loyalnost/paths/~1chain~1{chain_id}~1loyalty~1programs~1{loyalty_program_id}/get) Получить акцию в сети

get/chain/{chain\_id}/loyalty/programs/{loyalty\_program\_id}

https://api.yclients.com/api/v1/chain/{chain\_id}/loyalty/programs/{loyalty\_program\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| chain\_id<br>required | integer<br>Идентификатор сети |
| loyalty\_program\_id<br>required | integer<br>Идентификатор акции |

##### query Parameters

|     |     |
| --- | --- |
| include | string<br>Enum:"applicable\_items""rules""companies""loyalty\_card\_types""on\_changed\_notification\_template""on\_expiration\_notification\_template"<br>Включить в ответ дополнительные ресурсы |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| id | integer<int32><br>Идетификатор акции |
| title | string<br>Название акции |
| type | string<br>Enum:"discount\_static""discount\_accumulative\_visits""discount\_accumulative\_sold""discount\_accumulative\_paid""cashback\_static\_sold""cashback\_static\_paid""cashback\_accumulative\_paid""cashback\_accumulative\_sold""cashback\_accumulative\_paid\_visits""cashback\_accumulative\_sold\_visits""cashback\_sold\_visits""cashback\_paid\_visits""package\_discount"<br>Тип акции |
| service\_item\_type | string<br>Enum:"any\_allowed""not\_allowed""custom\_allowed"<br>Тип применения к услугам |
| good\_item\_type | string<br>Enum:"any\_allowed""not\_allowed""custom\_allowed"<br>Тип применения к товарам |
| value\_unit | string<br>Enum:"percent""amount"<br>Единица измерения бонуса или скидки (процент, фиксированная сумма) |
| usage\_limit | integer<int32><br>Ограничение по количеству применений (только для кэшбека) |
| visit\_multiplicity | integer<int32><br>Кратность применения по визитам (только для кэшбека) |
| sold\_items\_multiplicity | integer<int32><br>Сколько услуг нужно оплатить, чтобы получить скидку на акционные услуги (только для типа акции "Скидка по условию") |
| expiration\_timeout | integer<int32><br>Срок сгорания бонусов или скидки |
| expiration\_timeout\_unit | string<br>Enum:"day""week""month""year"<br>Единица измерения срока сгорания бонусов или скидки |
| expiration\_notification\_timeout | integer<int32><br>За сколько дней до наступления срока сгорания бонуса или скидки необходимо отправить клиенту уведомление |
| params\_source\_type | string<br>Enum:"loyalty\_card""active\_companies""chain"<br>Откуда брать историю клиента для расчета размера бонуса или скидки (для накпоительных акций или скидки по условию) |
| history\_start\_date | string<date><br>С какой даты учитывать историю клиента для расчета размера бонуса или скидки (для накопительных акций или скидки по условию) |
| on\_changed\_notification\_template\_id | integer<int32><br>Идентификатор шаблона уведомления при изменении бонуса или скидки |
| on\_expiration\_notification\_template\_id | integer<int32><br>Идентификатор шаблона уведомления при сгорании бонуса или скидки |
| loyalty\_card\_types | Array of objects (Root Type for LoyaltyCardType) <br>Тип карт, для которых действует акция (по запросу) |
| on\_changed\_notification\_template | object (Root Type for LoyaltyNotificationMessageTemplate) <br>Шаблон уведомлений лояльности |
| on\_expiration\_notification\_template | object (Root Type for LoyaltyNotificationMessageTemplate) <br>Шаблон уведомлений лояльности |
| rules | Array of objects (Root Type for LoyaltyProgramRule) <br>Правила для определения значения бонуса или скидки (допустимо только одно правило для фиксированных акций) (по запросу) |
| companies | Array of objects (Company) <br>Филиалы, в которых действует акция (по запросу) |
| applicable\_items | Array of objects (Root Type for LoyaltyEntityAttendanceItem) <br>Связанные сущности для выборочного применения акции (по запросу) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"id": 34,
"title": "Накопительная скидка для некоторых услуг и не для товаров",
"type": "discount_accumulative_paid",
"service_item_type": "custom_allowed",
"good_item_type": "not_allowed",
"value_unit": "percent",
"usage_limit": 0,
"visit_multiplicity": 0,
"sold_items_multiplicity": 0,
"expiration_timeout": 6,
"expiration_timeout_unit": "month",
"expiration_notification_timeout": 7,
"params_source_type": "chain",
"history_start_date": 1516147200,
"on_changed_notification_template_id": 55,
"on_expiration_notification_template_id": 84,
"loyalty_card_types": [\
{\
"id": 51,\
"title": "Тип карты 1"},\
{\
"id": 29,\
"title": "Тип карты 2"}],
"on_changed_notification_template": {
"id": 55,
"type": "custom",
"body": "Ваша скидка изменилась",
"message_type": "loyalty_discount_changed"},
"on_expiration_notification_template": {
"id": 84,
"type": "big",
"body": "Подробный текст о сгорании скидки",
"message_type": "loyalty_discount_expiration"},
"rules": [\
{\
"id": 94,\
"parameter": 10,\
"value": 2.5,\
"loyalty_program_id": 34,\
"loyalty_type_id": 3,\
"service_id": 0},\
{\
"id": 74,\
"parameter": 30,\
"value": 7.5,\
"loyalty_program_id": 34,\
"loyalty_type_id": 3,\
"service_id": 0}],
"companies": [\
{\
"id": 49,\
"title": "Филиал",\
"country": "Россия",\
"country_id": 5,\
"city": "Москва",\
"city_id": 83,\
"phone": "7912345678",\
"timezone": "Europe/Moscow",\
"address": "Адрес филиала",\
"coordinate_lat": 77.32,\
"coordinate_lng": 18.63}],
"applicable_items": [\
{\
"id": 53,\
"title": "Категория услуг 1",\
"is_service": true,\
"is_category": true},\
{\
"id": 92,\
"title": "Категория услуг 2",\
"is_service": true,\
"is_category": true}]}`

## [tag/Loyalnost/paths/~1chain~1{chain_id}~1loyalty~1programs~1{loyalty_program_id}/put](https://developers.yclients.com/ru/\#tag/Loyalnost/paths/~1chain~1{chain_id}~1loyalty~1programs~1{loyalty_program_id}/put) Изменить акцию в сети

put/chain/{chain\_id}/loyalty/programs/{loyalty\_program\_id}

https://api.yclients.com/api/v1/chain/{chain\_id}/loyalty/programs/{loyalty\_program\_id}

##### Authorizations:

_bearer_

##### path Parameters

|     |     |
| --- | --- |
| chain\_id<br>required | integer<br>Идентификатор сети |
| loyalty\_program\_id<br>required | integer<br>Идентификатор акции |

##### query Parameters

|     |     |
| --- | --- |
| include | string<br>Enum:"applicable\_items""rules""companies""loyalty\_card\_types""on\_changed\_notification\_template""on\_expiration\_notification\_template"<br>Включить в ответ дополнительные ресурсы |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| title | string<br>Название акции |
| usage\_limit | integer<int32><br>Ограничение по количеству применений (только для кэшбека) |
| expiration\_timeout | integer<int32><br>Срок сгорания бонусов или скидки |
| expiration\_timeout\_unit | string<br>Enum:"day""week""month""year"<br>Единица измерения срока сгорания бонусов или скидки |
| expiration\_notification\_timeout | integer<int32><br>За сколько дней до наступления срока сгорания бонуса или скидки необходимо отправить клиенту уведомление |
| loyalty\_card\_type\_ids | Array of integers<int32>\[ items <int32 > \]<br>Идентификаторы типов карт, для которых действует акция |
| on\_changed\_notification\_template | object (Root Type for LoyaltyNotificationMessageTemplateRequest) <br>Тело запроса на привязку шаблона уведомления лояльности |
| on\_expiration\_notification\_template | object (Root Type for LoyaltyNotificationMessageTemplateRequest) <br>Тело запроса на привязку шаблона уведомления лояльности |
| rules | Array of objects (Root Type for LoyaltyProgramRuleRequest) <br>Правила для определения значения бонуса или скидки (допустимо только одно правило для фиксированных акций) |
| company\_ids | Array of integers<int32>\[ items <int32 > \]<br>Идентификаторы филиалов, в которых действует акция |
| allowed\_service\_ids | Array of integers<int32>\[ items <int32 > \]<br>Идентификаторы услуг и категорий услуг (если задан тип применения для некоторых услуг) |
| allowed\_good\_ids | Array of integers<int32>\[ items <int32 > \]<br>Идентификаторы товаров (если задан тип применения для некоторых товаров) |
| allowed\_good\_category\_ids | Array of integers<int32>\[ items <int32 > \]<br>Идентификаторы категорий товаров (если задан тип применения для некоторых товаров) |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| id | integer<int32><br>Идетификатор акции |
| title | string<br>Название акции |
| type | string<br>Enum:"discount\_static""discount\_accumulative\_visits""discount\_accumulative\_sold""discount\_accumulative\_paid""cashback\_static\_sold""cashback\_static\_paid""cashback\_accumulative\_paid""cashback\_accumulative\_sold""cashback\_accumulative\_paid\_visits""cashback\_accumulative\_sold\_visits""cashback\_sold\_visits""cashback\_paid\_visits""package\_discount"<br>Тип акции |
| service\_item\_type | string<br>Enum:"any\_allowed""not\_allowed""custom\_allowed"<br>Тип применения к услугам |
| good\_item\_type | string<br>Enum:"any\_allowed""not\_allowed""custom\_allowed"<br>Тип применения к товарам |
| value\_unit | string<br>Enum:"percent""amount"<br>Единица измерения бонуса или скидки (процент, фиксированная сумма) |
| usage\_limit | integer<int32><br>Ограничение по количеству применений (только для кэшбека) |
| visit\_multiplicity | integer<int32><br>Кратность применения по визитам (только для кэшбека) |
| sold\_items\_multiplicity | integer<int32><br>Сколько услуг нужно оплатить, чтобы получить скидку на акционные услуги (только для типа акции "Скидка по условию") |
| expiration\_timeout | integer<int32><br>Срок сгорания бонусов или скидки |
| expiration\_timeout\_unit | string<br>Enum:"day""week""month""year"<br>Единица измерения срока сгорания бонусов или скидки |
| expiration\_notification\_timeout | integer<int32><br>За сколько дней до наступления срока сгорания бонуса или скидки необходимо отправить клиенту уведомление |
| params\_source\_type | string<br>Enum:"loyalty\_card""active\_companies""chain"<br>Откуда брать историю клиента для расчета размера бонуса или скидки (для накпоительных акций или скидки по условию) |
| history\_start\_date | string<date><br>С какой даты учитывать историю клиента для расчета размера бонуса или скидки (для накопительных акций или скидки по условию) |
| on\_changed\_notification\_template\_id | integer<int32><br>Идентификатор шаблона уведомления при изменении бонуса или скидки |
| on\_expiration\_notification\_template\_id | integer<int32><br>Идентификатор шаблона уведомления при сгорании бонуса или скидки |
| loyalty\_card\_types | Array of objects (Root Type for LoyaltyCardType) <br>Тип карт, для которых действует акция (по запросу) |
| on\_changed\_notification\_template | object (Root Type for LoyaltyNotificationMessageTemplate) <br>Шаблон уведомлений лояльности |
| on\_expiration\_notification\_template | object (Root Type for LoyaltyNotificationMessageTemplate) <br>Шаблон уведомлений лояльности |
| rules | Array of objects (Root Type for LoyaltyProgramRule) <br>Правила для определения значения бонуса или скидки (допустимо только одно правило для фиксированных акций) (по запросу) |
| companies | Array of objects (Company) <br>Филиалы, в которых действует акция (по запросу) |
| applicable\_items | Array of objects (Root Type for LoyaltyEntityAttendanceItem) <br>Связанные сущности для выборочного применения акции (по запросу) |

**422**
Ошибка валидации

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"title": "Накопительная скидка для некоторых услуг и не для товаров",
"allowed_service_ids": [\
53,\
92],
"allowed_good_ids": [ ],
"allowed_good_category_ids": [ ],
"usage_limit": 0,
"expiration_timeout": 6,
"expiration_timeout_unit": "month",
"expiration_notification_timeout": 7,
"loyalty_card_type_ids": [\
51,\
29],
"on_changed_notification_template": {
"type": "custom",
"body": "Ваша скидка изменилась"},
"on_expiration_notification_template": {
"type": "big"},
"rules": [\
{\
"parameter": 10,\
"value": 2.5,\
"service_id": 0},\
{\
"parameter": 30,\
"value": 7.5,\
"service_id": 0}],
"company_ids": [\
49]}`

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"id": 34,
"title": "Накопительная скидка для некоторых услуг и не для товаров",
"type": "discount_accumulative_paid",
"service_item_type": "custom_allowed",
"good_item_type": "not_allowed",
"value_unit": "percent",
"usage_limit": 0,
"visit_multiplicity": 0,
"sold_items_multiplicity": 0,
"expiration_timeout": 6,
"expiration_timeout_unit": "month",
"expiration_notification_timeout": 7,
"params_source_type": "chain",
"history_start_date": 1516147200,
"on_changed_notification_template_id": 55,
"on_expiration_notification_template_id": 84,
"loyalty_card_types": [\
{\
"id": 51,\
"title": "Тип карты 1"},\
{\
"id": 29,\
"title": "Тип карты 2"}],
"on_changed_notification_template": {
"id": 55,
"type": "custom",
"body": "Ваша скидка изменилась",
"message_type": "loyalty_discount_changed"},
"on_expiration_notification_template": {
"id": 84,
"type": "big",
"body": "Подробный текст о сгорании скидки",
"message_type": "loyalty_discount_expiration"},
"rules": [\
{\
"id": 94,\
"parameter": 10,\
"value": 2.5,\
"loyalty_program_id": 34,\
"loyalty_type_id": 3,\
"service_id": 0},\
{\
"id": 74,\
"parameter": 30,\
"value": 7.5,\
"loyalty_program_id": 34,\
"loyalty_type_id": 3,\
"service_id": 0}],
"companies": [\
{\
"id": 49,\
"title": "Филиал",\
"country": "Россия",\
"country_id": 5,\
"city": "Москва",\
"city_id": 83,\
"phone": "7912345678",\
"timezone": "Europe/Moscow",\
"address": "Адрес филиала",\
"coordinate_lat": 77.32,\
"coordinate_lng": 18.63}],
"applicable_items": [\
{\
"id": 53,\
"title": "Категория услуг 1",\
"is_service": true,\
"is_category": true},\
{\
"id": 92,\
"title": "Категория услуг 2",\
"is_service": true,\
"is_category": true}]}`

## [tag/Loyalnost/paths/~1chain~1{chain_id}~1loyalty~1programs~1{loyalty_program_id}/delete](https://developers.yclients.com/ru/\#tag/Loyalnost/paths/~1chain~1{chain_id}~1loyalty~1programs~1{loyalty_program_id}/delete) Удалить акцию в сети

delete/chain/{chain\_id}/loyalty/programs/{loyalty\_program\_id}

https://api.yclients.com/api/v1/chain/{chain\_id}/loyalty/programs/{loyalty\_program\_id}

##### Authorizations:

_bearer_

##### path Parameters

|     |     |
| --- | --- |
| chain\_id<br>required | integer<br>Идентификатор сети |
| loyalty\_program\_id<br>required | integer<br>Идентификатор акции |

##### query Parameters

|     |     |
| --- | --- |
| include | string<br>Enum:"applicable\_items""rules""companies""loyalty\_card\_types""on\_changed\_notification\_template""on\_expiration\_notification\_template"<br>Включить в ответ дополнительные ресурсы |

### Responses

**204**
No content

## [tag/Loyalnost/paths/~1chain~1{chain_id}~1loyalty~1transactions/get](https://developers.yclients.com/ru/\#tag/Loyalnost/paths/~1chain~1{chain_id}~1loyalty~1transactions/get) Получить список транзакций лояльности в сети

get/chain/{chain\_id}/loyalty/transactions

https://api.yclients.com/api/v1/chain/{chain\_id}/loyalty/transactions

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| chain\_id<br>required | integer<br>Идентификатор сети |

##### query Parameters

|     |     |
| --- | --- |
| created\_after<br>required | string<date><br>Дата начала выборки в формате Y-m-d |
| created\_before<br>required | string<date><br>Дата окончания выборки в формате Y-m-d |
| types | Array of strings<br>ItemsEnum:"1""2""3""4""5""6""7""8""9""10""11"<br>Типы транзакций лояльности, включенные в выборку: 1 - Скидка по акции, 2 - Начисление по программе лояльности, 3 - Списание с карты лояльности, 4 - Начисление по реферальной программе, 5 - Ручное пополнение, 6 - Ручное списание, 7 - Списание просроченных баллов, 8 - Списание с сертификата, 9 - Использование абонемента, 10 - Перерасчет стоимости по абонементу, 11 - Списание с личного счета |
| company\_ids | Array of integers<br>Идентификаторы филиалов транзакций лояльности, включенные в выборку |
| visit\_ids | Array of integers<br>Идентификаторы визитов транзакций лояльности, включенные в выборку |
| loyalty\_card\_id | integer<br>Идентификатор карты лояльности, включенный в выборку |
| page | integer<br>Страница выборки |
| count | integer<br>Количество результатов на одной странице выборки |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | object<br>Метаданные (содержит количество элементов в ответе) |

**422**
Ошибка валидации

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 0,\
"visit_id": 0,\
"status_id": 0,\
"amount": 0,\
"type_id": 0,\
"card_id": 0,\
"program_id": 0,\
"certificate_id": 0,\
"abonement_id": 0,\
"salon_group_id": 0,\
"item_id": 0,\
"item_type_id": 0,\
"item_record_id": 0,\
"goods_transaction_id": 0,\
"services_transaction_id": 0,\
"is_discount": true,\
"is_loyalty_withdraw": true,\
"type": {\
"id": 0,\
"title": "string"}}],
"meta": {
"count": 0}}`

## [tag/Loyalnost/paths/~1loyalty~1generate_code~1{company_id}~1{good_Id}/get](https://developers.yclients.com/ru/\#tag/Loyalnost/paths/~1loyalty~1generate_code~1{company_id}~1{good_Id}/get) Генерация кода сертификата/абонемента

get/loyalty/generate\_code/{company\_id}/{good\_Id}

https://api.yclients.com/api/v1/loyalty/generate\_code/{company\_id}/{good\_Id}

- Параметры
  - salonId (required, number, `1`) \- ID салона
  - goodId (required, number, `1`) \- ID товара (сертификат/абонемент)

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Идентификатор филиала |
| good\_Id<br>required | number<br>Идентификатор товара (абонемент/сертификат) |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| LoyaltyGenerateCode200Option | object (LoyaltyGenerateCode200Option) |
| data<br>required | object (LoyaltyGenerateCode200DataOption) |
| meta<br>required | Array of objects |
| success<br>required | boolean |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| LoyaltyGenerateCodeErrorOption | object (LoyaltyGenerateCodeErrorOption) |
| meta<br>required | object (LoyaltyGenerateCodeErrorMetaOption) |
| success<br>required | boolean |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| LoyaltyGenerateCodeErrorOption | object (LoyaltyGenerateCodeErrorOption) |
| meta<br>required | object (LoyaltyGenerateCodeErrorMetaOption) |
| success<br>required | boolean |

### Response samples

- 200
- 403
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"code": "1"},
"meta": [ ]}`

## [tag/Loyalnost/operation/Получить список доступных типов абонементов](https://developers.yclients.com/ru/\#tag/Loyalnost/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%BE%D0%BA%20%D0%B4%D0%BE%D1%81%D1%82%D1%83%D0%BF%D0%BD%D1%8B%D1%85%20%D1%82%D0%B8%D0%BF%D0%BE%D0%B2%20%D0%B0%D0%B1%D0%BE%D0%BD%D0%B5%D0%BC%D0%B5%D0%BD%D1%82%D0%BE%D0%B2) Получить список доступных типов абонементов

get/company/{company\_id}/loyalty/abonement\_types/search

https://api.yclients.com/api/v1/company/{company\_id}/loyalty/abonement\_types/search

Список **типов абонементов**, доступных в филиале, можно получить, сделав запрос с указанием идентификатора филиала.
Список можно отфильтровать по названию типа абонемента, передав параметр `title`.
Поддерживается постраничный вывод, задаваемый параметрами `page` и `page_size`.

Список представляет собой массив [типов абонементов](https://developers.yclients.com/ru/#loyalty-abonement-type).

**Тип абонемента** имеет следующую структуру:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | Идентификатор типа абонемента |
| title | string | Название типа абонемента |
| allow\_freeze | boolean | Допускается ли заморозка абонементов? true - допускается, false - не допускается |
| freeze\_limit | number | Максимальный общий период заморозки (дни) |
| salon\_group\_id | number | Идентификатор сети, в которой действует тип абонемента |
| period | number | Срок действия абонемента (0, если не задан) |
| period\_unit\_id | number | Единица измерения срока действия абонемента ( [список возможных значений](https://developers.yclients.com/ru/#loyalty-abonement-expiration-unit), если не задан \- 0) |
| is\_allow\_empty\_code | boolean | Разрешить продажу абонемента без кода? true - разрешить, false - не разрешать |
| is\_united\_balance | boolean | Общий или раздельный баланс абонемента: true - общий, false - раздельный |
| united\_balance\_services\_count | number | Количество посещений для общего баланса |

**Единицы измерения срока действия типа абонемента**

| Значение | Описание |
| --- | --- |
| 1 | День |
| 2 | Неделя |
| 3 | Месяц |
| 4 | Год |

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### query Parameters

|     |     |
| --- | --- |
| title | string<br>Название типа абонемента |
| page | number<br>Номер страницы |
| page\_size | number<br>Количество выводимых строк на странице. Максимум 100 |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Conetnt-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив с объектами данных |
| meta | object<br>Метаданные (содержит количество найденных типов абонементов) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 12233,\
"salon_group_id": 123,\
"title": "Абонемент с возможностью заморозки на 14 дней",\
"period": 0,\
"period_unit_id": 0,\
"allow_freeze": true,\
"freeze_limit": 14,\
"is_allow_empty_code": false,\
"is_united_balance": false,\
"united_balance_services_count": 0},\
{\
"id": 255789,\
"salon_group_id": 456,\
"title": "Абонемент на 6 месяцев",\
"period": 6,\
"period_unit_id": 3,\
"allow_freeze": false,\
"freeze_limit": 0,\
"is_allow_empty_code": false,\
"is_united_balance": false,\
"united_balance_services_count": 0}],
"meta": {
"count": 2}}`

## [tag/Loyalnost/operation/Получить список типов абонементов по идентификатору](https://developers.yclients.com/ru/\#tag/Loyalnost/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%BE%D0%BA%20%D1%82%D0%B8%D0%BF%D0%BE%D0%B2%20%D0%B0%D0%B1%D0%BE%D0%BD%D0%B5%D0%BC%D0%B5%D0%BD%D1%82%D0%BE%D0%B2%20%D0%BF%D0%BE%20%D0%B8%D0%B4%D0%B5%D0%BD%D1%82%D0%B8%D1%84%D0%B8%D0%BA%D0%B0%D1%82%D0%BE%D1%80%D1%83) Получить список типов абонементов по идентификатору

get/company/{company\_id}/loyalty/abonement\_types/fetch

https://api.yclients.com/api/v1/company/{company\_id}/loyalty/abonement\_types/fetch

Список **типов абонементов**, доступных в филиале, можно получить, сделав запрос с указанием идентификатора филиала и идентификаторов типов абонементов.

Список представляет собой массив [типов абонементов](https://developers.yclients.com/ru/#loyalty-abonement-type).

### Получить список типов абонементов по идентификатору

- Parameters
  - company\_id (required, number) - ID компании
  - id: 1 (optional, number) - ID типа абонемента (можно указать несколько дополнительными параметрами `&ids[]={id}`

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### query Parameters

|     |     |
| --- | --- |
| ids\[\] | number<br>ID типа абонемента (можно указать несколько дополнительными параметрами &ids\[\]={id} |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив с объектами данных |
| meta | object<br>Метаданные (содержит количество найденных типов абонементов) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 12233,\
"salon_group_id": 123,\
"title": "Абонемент с возможностью заморозки на 14 дней",\
"period": 0,\
"period_unit_id": 0,\
"allow_freeze": true,\
"freeze_limit": 14,\
"is_allow_empty_code": false,\
"is_united_balance": false,\
"united_balance_services_count": 0}],
"meta": {
"count": 1}}`

## [tag/Loyalnost/operation/Получить список доступных типов сертификатов](https://developers.yclients.com/ru/\#tag/Loyalnost/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%BE%D0%BA%20%D0%B4%D0%BE%D1%81%D1%82%D1%83%D0%BF%D0%BD%D1%8B%D1%85%20%D1%82%D0%B8%D0%BF%D0%BE%D0%B2%20%D1%81%D0%B5%D1%80%D1%82%D0%B8%D1%84%D0%B8%D0%BA%D0%B0%D1%82%D0%BE%D0%B2) Получить список доступных типов сертификатов

get/company/{company\_id}/loyalty/certificate\_types/search

https://api.yclients.com/api/v1/company/{company\_id}/loyalty/certificate\_types/search

Список **типов сертификатов**, доступных в филиале, можно получить, сделав запрос с указанием идентификатора филиала.
Список можно отфильтровать по названию типа сертификата, передав параметр `title`.
Поддерживается постраничный вывод, задаваемый параметрами `page` и `page_size`.

Список представляет собой массив [типов сертификатов](https://developers.yclients.com/ru/#loyalty-certificate-type).

**Тип сертификата** имеет следующую структуру:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | Идентификатор типа сертификата |
| title | string | Название типа сертификата |
| balance | number | Номинал сертификата |
| is\_multi | boolean | Тип списания: true - многократное списание, false - однократное списание |
| company\_group\_id | number | Идентификатор сети, в которой действует тип сертификата |
| item\_type\_id | number | Ограничение применения ( [список возможных значений](https://developers.yclients.com/ru/#loyalty-certificate-item-type)) |
| expiration\_type\_id | number | Ограничение срока действия ( [список возможных значений](https://developers.yclients.com/ru/#loyalty-certificate-expiration-type)) |
| expiration\_date | string | Фиксированная дата сгорания в формате ISO8601 (null, если не задана) |
| expiration\_timeout | number | Срок действия сертификата с момента продажи (0, если не задан) |
| expiration\_timeout\_unit\_id | number | Единица измерения срока действия сертификата с момента продажи ( [список возможных значений](https://developers.yclients.com/ru/#loyalty-certificate-expiration-unit), если не задан \- 0) |
| is\_allow\_empty\_code | boolean | Разрешить продажу сертификата без кода? true - разрешить, false - не разрешать |

**Ограничение применения типа сертификата**

| Значение | Описание |
| --- | --- |
| 0 | Без ограничений |
| 1 | Любые услуги без товаров |
| 2 | Любые товары без услуг |
| 3 | Некоторые услуги без товаров |
| 4 | Некоторые услуги и любые товары |

**Ограничение срока действия типа сертификата**

| Значение | Описание |
| --- | --- |
| 0 | Без ограничения срока действия |
| 1 | Фиксированная дата для всех экземпляров |
| 2 | Фиксированный срок действия с момента продажи |

**Единицы измерения срока действия типа сертификата**

| Значение | Описание |
| --- | --- |
| 1 | День |
| 2 | Неделя |
| 3 | Месяц |
| 4 | Год |

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### query Parameters

|     |     |
| --- | --- |
| title | string<br>Название типа сертификата |
| page | number<br>Номер страницы |
| page\_size | number<br>Количество выводимых строк на странице. Максимум 100 |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | integer<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | object<br>Метаданные (содержит количество найденных типов сертификатов) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 1,\
"title": "Сертификат с фиксированной датой сгорания без ограничений применения",\
"balance": 10,\
"is_multi": true,\
"company_group_id": 12,\
"item_type_id": 0,\
"expiration_type_id": 1,\
"expiration_date": 1482765943,\
"expiration_timeout": 0,\
"expiration_timeout_unit_id": 0,\
"is_allow_empty_code": true},\
{\
"id": 11,\
"title": "Сертификат, действующий 6 месяцев с момента продажи на любые товары без услуг",\
"balance": 100,\
"is_multi": false,\
"company_group_id": 12,\
"item_type_id": 2,\
"expiration_type_id": 2,\
"expiration_timeout": 6,\
"expiration_timeout_unit_id": 3,\
"is_allow_empty_code": false}],
"meta": {
"count": 2}}`

## [tag/Loyalnost/operation/Получить список типов сертификатов по идентификатору](https://developers.yclients.com/ru/\#tag/Loyalnost/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%BE%D0%BA%20%D1%82%D0%B8%D0%BF%D0%BE%D0%B2%20%D1%81%D0%B5%D1%80%D1%82%D0%B8%D1%84%D0%B8%D0%BA%D0%B0%D1%82%D0%BE%D0%B2%20%D0%BF%D0%BE%20%D0%B8%D0%B4%D0%B5%D0%BD%D1%82%D0%B8%D1%84%D0%B8%D0%BA%D0%B0%D1%82%D0%BE%D1%80%D1%83) Получить список типов сертификатов по идентификатору

get/company/{company\_id}/loyalty/certificate\_types/fetch

https://api.yclients.com/api/v1/company/{company\_id}/loyalty/certificate\_types/fetch

Список **типов сертификатов**, доступных в филиале, можно получить, сделав запрос с указанием идентификатора филиала и идентификаторов типов сертификатов.

Список представляет собой массив [типов сертификатов](https://developers.yclients.com/ru/#loyalty-certificate-type).

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | object<br>Метаданные (содержит количество найденных типов сертификатов) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 1,\
"title": "Сертификат с фиксированной датой сгорания без ограничений применения",\
"balance": 10,\
"is_multi": true,\
"company_group_id": 12,\
"item_type_id": 0,\
"expiration_type_id": 1,\
"expiration_date": 1482765943,\
"expiration_timeout": 0,\
"expiration_timeout_unit_id": 0,\
"is_allow_empty_code": true}],
"meta": {
"count": 1}}`

## [tag/Loyalnost/paths/~1company~1{company_id}~1loyalty~1programs~1search/get](https://developers.yclients.com/ru/\#tag/Loyalnost/paths/~1company~1{company_id}~1loyalty~1programs~1search/get) Получить список акций, действующих в филиале

get/company/{company\_id}/loyalty/programs/search

https://api.yclients.com/api/v1/company/{company\_id}/loyalty/programs/search

Метод позволяет получить список акций, которые активны для указанного филиала.

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Идентификатор компании |

##### query Parameters

|     |     |
| --- | --- |
| include | string<br>Значение first\_transaction\_date добавляет в ответ дату первой транзакции по акции. |
| type | string<br>Enum:"discount\_static""discount\_accumulative\_visits""discount\_accumulative\_sold""discount\_accumulative\_paid""cashback\_static\_sold""cashback\_static\_paid""cashback\_accumulative\_paid""cashback\_accumulative\_sold""cashback\_accumulative\_paid\_visits""cashback\_accumulative\_sold\_visits""cashback\_sold\_visits""cashback\_paid\_visits""package\_discount"<br>Тип акции |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer bearer\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения. |
| data | Array of objects<br>Массив объектов с данными. |
| meta | object<br>Метаданные (содержит количество найденных объектов) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 53591,\
"title": "скидка 100р на Консультация по внедрению YCLIENTS",\
"type": "discount_static",\
"loyalty_type_id": 1,\
"item_type_id": 4,\
"service_item_type": "custom_allowed",\
"good_item_type": "any_allowed",\
"value_unit_id": 2,\
"value_unit": "amount",\
"group_id": 502054,\
"usage_limit": 0,\
"visit_multiplicity": 1,\
"sold_items_multiplicity": 1,\
"current_package_progress": 0,\
"allowed_usages_amount": 0,\
"expiration_timeout": 0,\
"expiration_timeout_unit": "day",\
"expiration_notification_timeout": 0,\
"params_source_type": "loyalty_card",\
"on_changed_notification_template_id": 0,\
"on_expiration_notification_template_id": 0}],
"meta": {
"count": 1}}`

## [tag/Loyalnost/paths/~1company~1{company_id}~1analytics~1loyalty_programs~1visits/get](https://developers.yclients.com/ru/\#tag/Loyalnost/paths/~1company~1{company_id}~1analytics~1loyalty_programs~1visits/get) Получить статистику по клиентам

get/company/{company\_id}/analytics/loyalty\_programs/visits

https://api.yclients.com/api/v1/company/{company\_id}/analytics/loyalty\_programs/visits

Метод позволяет получить статистику по вернувшимся, новым и потерянным клиентам

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Идентификатор компании |

##### query Parameters

|     |     |
| --- | --- |
| date\_to<br>required | string<br>Дата окончания периода |
| date\_from<br>required | string<br>Дата начала периода |
| loyalty\_program\_id<br>required | string<br>Идентификатор акции |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer bearer\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"client_stats": {
"new": {
"all_count": 0,
"lost_count": 0,
"returned_count": 0,
"returned_percent": 0},
"old": {
"all_count": 0,
"lost_count": 0,
"returned_count": 0,
"returned_percent": 0},
"total": {
"all_count": 0,
"lost_count": 0,
"returned_count": 0,
"returned_percent": 0}},
"visits_stats_by_day": [\
{\
"date": 1625097600,\
"new_count": 0,\
"old_count": 0},\
{\
"date": 1625184000,\
"new_count": 0,\
"old_count": 0}]},
"meta": [ ]}`

## [tag/Loyalnost/paths/~1company~1{company_id}~1analytics~1loyalty_programs~1income~1/get](https://developers.yclients.com/ru/\#tag/Loyalnost/paths/~1company~1{company_id}~1analytics~1loyalty_programs~1income~1/get) Получить статистику по выручке

get/company/{company\_id}/analytics/loyalty\_programs/income/

https://api.yclients.com/api/v1/company/{company\_id}/analytics/loyalty\_programs/income/

Метод позволяет получить статистику по выручке.

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Идентификатор компании |

##### query Parameters

|     |     |
| --- | --- |
| date\_to<br>required | string<br>Дата окончания периода |
| date\_from<br>required | string<br>Дата начала периода |
| loyalty\_program\_id<br>required | string<br>Идентификатор акции |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer bearer\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"income_stats": {
"new": {
"all_sum": 0,
"returned_sum": 0},
"old": {
"all_sum": 0,
"returned_sum": 0},
"total": {
"all_sum": 0,
"returned_sum": 0}},
"currency": {
"id": 1,
"iso": "RUB",
"name": "Russian Ruble",
"symbol": "₽",
"is_symbol_after_amount": true},
"income_stats_by_day": [\
{\
"date": 1625097600,\
"new_sum": 0,\
"old_sum": 0},\
{\
"date": 1625184000,\
"new_sum": 0,\
"old_sum": 0}]},
"meta": [ ]}`

## [tag/Loyalnost/paths/~1company~1{company_id}~1analytics~1loyalty_programs~1staff~1/get](https://developers.yclients.com/ru/\#tag/Loyalnost/paths/~1company~1{company_id}~1analytics~1loyalty_programs~1staff~1/get) Получить возвращаемость по сотруднику

get/company/{company\_id}/analytics/loyalty\_programs/staff/

https://api.yclients.com/api/v1/company/{company\_id}/analytics/loyalty\_programs/staff/

Метод позволяет получить статистику возвращаемости по сотруднику

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Идентификатор компании |

##### query Parameters

|     |     |
| --- | --- |
| date\_to<br>required | string<br>Дата окончания периода |
| date\_from<br>required | string<br>Дата начала периода |
| loyalty\_program\_id<br>required | string<br>Идентификатор акции |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer bearer\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения |
| data | Array of objects<br>Массив с объектами данных |
| meta | object<br>Метаданные (содержит количество найденных объектов) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"client_stats": {\
"all_count": 1,\
"lost_count": 0,\
"returned_count": 1,\
"returned_percent": 100},\
"staff": {\
"id": 1140369,\
"name": "Дониэлла Дэви"}}],
"meta": {
"count": 1}}`

# [tag/Karty-loyalnosti](https://developers.yclients.com/ru/\#tag/Karty-loyalnosti) Карты лояльности

## [tag/Karty-loyalnosti/operation/Получить список типов карт доступных в филиале](https://developers.yclients.com/ru/\#tag/Karty-loyalnosti/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%BE%D0%BA%20%D1%82%D0%B8%D0%BF%D0%BE%D0%B2%20%D0%BA%D0%B0%D1%80%D1%82%20%D0%B4%D0%BE%D1%81%D1%82%D1%83%D0%BF%D0%BD%D1%8B%D1%85%20%D0%B2%20%D1%84%D0%B8%D0%BB%D0%B8%D0%B0%D0%BB%D0%B5) Получить список типов карт доступных в филиале

get/loyalty/card\_types/salon/{company\_id}

https://api.yclients.com/api/v1/loyalty/card\_types/salon/{company\_id}

Возвращает список типов карт, которые действуют для данного филиала.

Атрибуты и их описания соответсвуют методу "Коллекция типов карт доступных клиенту", описанному выше.

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:12345<br>ID компании |

### Responses

**200**
OK

##### Response Schema: application/json

Array

|     |     |
| --- | --- |
| id | integer<int32><br>Идентификатор типа карты |
| title | string<br>Название типа карты |
| salon\_group\_id | integer<int32><br>Идентификатор сети, где создан тип карты |
| salon\_group | object<br>Объект, содержащий в себе поля "id" и "title": идентификатор сети, где создан тип карты и название этой сети |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`[\
{\
"id": 10992,\
"title": "Кэшбек",\
"salon_group_id": 145071,\
"salon_group": {\
"id": 145071,\
"title": "Сеть 1"}},\
{\
"id": 8230,\
"title": "Реферальная программа",\
"salon_group_id": 145071,\
"salon_group": {\
"id": 145071,\
"title": "Сеть 1"}}]`

## [tag/Karty-loyalnosti/operation/Получить список карт клиента по номеру телефона](https://developers.yclients.com/ru/\#tag/Karty-loyalnosti/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%BE%D0%BA%20%D0%BA%D0%B0%D1%80%D1%82%20%D0%BA%D0%BB%D0%B8%D0%B5%D0%BD%D1%82%D0%B0%20%D0%BF%D0%BE%20%D0%BD%D0%BE%D0%BC%D0%B5%D1%80%D1%83%20%D1%82%D0%B5%D0%BB%D0%B5%D1%84%D0%BE%D0%BD%D0%B0) Получить список карт клиента по номеру телефона

get/loyalty/cards/{phone}/{group\_id}/{company\_id}

https://api.yclients.com/api/v1/loyalty/cards/{phone}/{group\_id}/{company\_id}

Возвращает список карт клиента с программами, которые активны в данном салоне

| Атрибут | Тип | Описание |
| --- | --- | --- |
| id | int | Идентификатор карты лояльности |
| balance | decimal | Баланс карты лояльности |
| paid\_amount | decimal | Сумма "Оплачено" |
| sold\_amount | decimal | Сумма "Продано" |
| visits\_count | int | Количество визитов |
| number | string | Номер карты |
| type\_id | int | Идентификатор типа карты лояльности |
| salon\_group\_id | int | Идентификатор сети, где создана карта |
| type | object | Объект, содержащий в себе поля "id" и "title": идентификатор типа карты и название типа карты, соотвественно |
| salon\_group | object | Объект, содержащий в себе поля "id" и "title": идентификатор сети, где создан тип карты и название этой сети |
| programs | array | Массив с информацией об акциях, привязанных к карте лояльности |
| rules | array | Массив с информацией о правилах, настроенных в акции |

Массив programs состоит из объектов со следующими полями:

| Атрибут | Тип | Описание |
| --- | --- | --- |
| id | int | Идентификатор акции |
| title | string | Название акции |
| loyalty\_type\_id | int | Идентификатор типа акции |
| item\_type\_id | int | Начисляется ли кэшбек от товаров |
| value\_unit\_id | int | Поле "Бонус". Скидка % или Фикс. сумма |
| group\_id | int | Идентифкатор сети, где создана акция |
| loyalty\_type | object | Объект с информацией о акции |

Массив rules состоит из объектов со следующими полями:

| Атрибут | Тип | Описание |
| --- | --- | --- |
| id | int | Идентификатор правила |
| loyalty\_program\_id | int | Идентификатор акции, к которой привязано правило |
| loyalty\_type\_id | int | Идентификатор типа акции |
| value | decimal | Значение от которого сработает правило |

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| phone<br>required | string<br>Номер телефона клиента в формате 70001234567 |
| group\_id<br>required | number<br>ID сети |
| company\_id<br>required | number<br>ID филиала |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| id | integer<int32><br>Идентификатор карты лояльности |
| balance | number<float><br>Баланс карты лояльности |
| points | integer<int32> |
| paid\_amount | number<float><br>Сумма "Оплачено" |
| sold\_amount | number<float><br>Сумма "Продано" |
| visits\_count | integer<int32><br>Количество визитов |
| number | string<br>Номер карты |
| type\_id | integer<int32><br>Идентификатор типа карты лояльности |
| salon\_group\_id | integer<int32><br>Идентификатор сети, где создана карта |
| type | object<br>Объект, содержащий в себе поля "id" и "title": идентификатор типа карты и название типа карты, соотвественно |
| salon\_group | object<br>Объект, содержащий в себе поля "id" и "title": идентификатор сети, где создан тип карты и название этой сети |
| programs | Array of objects<br>Массив с информацией об акциях, привязанных к карте лояльности |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"id": 9210520,
"balance": 100,
"points": 0,
"paid_amount": 1000,
"sold_amount": 1000,
"visits_count": 1,
"number": 14507109210520,
"type_id": 10992,
"salon_group_id": 145071,
"type": {
"id": 10992,
"title": "5+2",
"salon_group_id": 145071},
"salon_group": {
"id": 145071,
"title": "Сеть тесто1."},
"programs": [\
{\
"id": 18005,\
"title": "5+2",\
"value": 0,\
"loyalty_type_id": 13,\
"item_type_id": 3,\
"value_unit_id": 1,\
"group_id": 145071,\
"loyalty_type": {\
"id": 13,\
"title": "Скидка по заданному количеству накопленных услуг",\
"is_discount": true,\
"is_cashback": false,\
"is_static": false,\
"is_accumulative": false},\
"rules": [\
{\
"id": 72803,\
"loyalty_program_id": 18005,\
"loyalty_type_id": 13,\
"value": 20,\
"parameter": 0},\
{\
"id": 72804,\
"loyalty_program_id": 18005,\
"loyalty_type_id": 13,\
"value": 10,\
"parameter": 0},\
{\
"id": 72805,\
"loyalty_program_id": 18005,\
"loyalty_type_id": 13,\
"value": 100,\
"parameter": 0}]}]}`

## [tag/Karty-loyalnosti/operation/Получить список карт клиента по ID](https://developers.yclients.com/ru/\#tag/Karty-loyalnosti/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%BE%D0%BA%20%D0%BA%D0%B0%D1%80%D1%82%20%D0%BA%D0%BB%D0%B8%D0%B5%D0%BD%D1%82%D0%B0%20%D0%BF%D0%BE%20ID) Получить список карт клиента по ID

get/loyalty/client\_cards/{client\_id}

https://api.yclients.com/api/v1/loyalty/client\_cards/{client\_id}

Возвращает список карт клиента с программами, которые активны в данном салоне

Атрибуты в ответе на запрос полностью совпадают с методом "Получить список выданных карт по номеру телефона", описанным выше

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| client\_id<br>required | number<br>ID клиента |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| id | integer<int32><br>Идентификатор карты лояльности |
| balance | number<float><br>Баланс карты лояльности |
| points | integer<int32> |
| paid\_amount | number<float><br>Сумма "Оплачено" |
| sold\_amount | number<float><br>Сумма "Продано" |
| visits\_count | integer<int32><br>Количество визитов |
| number | string<br>Номер карты |
| type\_id | integer<int32><br>Идентификатор типа карты лояльности |
| salon\_group\_id | integer<int32><br>Идентификатор сети, где создана карта |
| type | object<br>Объект, содержащий в себе поля "id" и "title": идентификатор типа карты и название типа карты, соотвественно |
| salon\_group | object<br>Объект, содержащий в себе поля "id" и "title": идентификатор сети, где создан тип карты и название этой сети |
| programs | Array of objects<br>Массив с информацией об акциях, привязанных к карте лояльности |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"id": 9210520,
"balance": 100,
"points": 0,
"paid_amount": 1000,
"sold_amount": 1000,
"visits_count": 1,
"number": 14507109210520,
"type_id": 10992,
"salon_group_id": 145071,
"type": {
"id": 10992,
"title": "5+2",
"salon_group_id": 145071},
"salon_group": {
"id": 145071,
"title": "Сеть тесто1."},
"programs": [\
{\
"id": 18005,\
"title": "5+2",\
"value": 0,\
"loyalty_type_id": 13,\
"item_type_id": 3,\
"value_unit_id": 1,\
"group_id": 145071,\
"loyalty_type": {\
"id": 13,\
"title": "Скидка по заданному количеству накопленных услуг",\
"is_discount": true,\
"is_cashback": false,\
"is_static": false,\
"is_accumulative": false},\
"rules": [\
{\
"id": 72803,\
"loyalty_program_id": 18005,\
"loyalty_type_id": 13,\
"value": 20,\
"parameter": 0},\
{\
"id": 72804,\
"loyalty_program_id": 18005,\
"loyalty_type_id": 13,\
"value": 10,\
"parameter": 0},\
{\
"id": 72805,\
"loyalty_program_id": 18005,\
"loyalty_type_id": 13,\
"value": 100,\
"parameter": 0}]}]}`

## [tag/Karty-loyalnosti/operation/Получить карты лояльности пользователя](https://developers.yclients.com/ru/\#tag/Karty-loyalnosti/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D0%BA%D0%B0%D1%80%D1%82%D1%8B%20%D0%BB%D0%BE%D1%8F%D0%BB%D1%8C%D0%BD%D0%BE%D1%81%D1%82%D0%B8%20%D0%BF%D0%BE%D0%BB%D1%8C%D0%B7%D0%BE%D0%B2%D0%B0%D1%82%D0%B5%D0%BB%D1%8F) Получить карты лояльности пользователя

get/user/loyalty\_cards/{group\_id}

https://api.yclients.com/api/v1/user/loyalty\_cards/{group\_id}

Возвращает список карт авторизованного пользователя с программами, фильтруя карты по сети салонов/салону

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| group\_id<br>required | number<br>ID сети |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| id | integer<int32><br>Идентификатор карты лояльности |
| balance | number<float><br>Баланс карты лояльности |
| points | integer<int32> |
| paid\_amount | number<float><br>Сумма "Оплачено" |
| sold\_amount | number<float><br>Сумма "Продано" |
| visits\_count | integer<int32><br>Количество визитов |
| number | string<br>Номер карты |
| type\_id | integer<int32><br>Идентификатор типа карты лояльности |
| salon\_group\_id | integer<int32><br>Идентификатор сети, где создана карта |
| type | object<br>Объект, содержащий в себе поля "id" и "title": идентификатор типа карты и название типа карты, соотвественно |
| salon\_group | object<br>Объект, содержащий в себе поля "id" и "title": идентификатор сети, где создан тип карты и название этой сети |
| programs | Array of objects<br>Массив с информацией об акциях, привязанных к карте лояльности |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"id": 9210520,
"balance": 100,
"points": 0,
"paid_amount": 1000,
"sold_amount": 1000,
"visits_count": 1,
"number": 14507109210520,
"type_id": 10992,
"salon_group_id": 145071,
"type": {
"id": 10992,
"title": "5+2",
"salon_group_id": 145071},
"salon_group": {
"id": 145071,
"title": "Сеть тесто1."},
"programs": [\
{\
"id": 18005,\
"title": "5+2",\
"value": 0,\
"loyalty_type_id": 13,\
"item_type_id": 3,\
"value_unit_id": 1,\
"group_id": 145071,\
"loyalty_type": {\
"id": 13,\
"title": "Скидка по заданному количеству накопленных услуг",\
"is_discount": true,\
"is_cashback": false,\
"is_static": false,\
"is_accumulative": false},\
"rules": [\
{\
"id": 72803,\
"loyalty_program_id": 18005,\
"loyalty_type_id": 13,\
"value": 20,\
"parameter": 0},\
{\
"id": 72804,\
"loyalty_program_id": 18005,\
"loyalty_type_id": 13,\
"value": 10,\
"parameter": 0},\
{\
"id": 72805,\
"loyalty_program_id": 18005,\
"loyalty_type_id": 13,\
"value": 100,\
"parameter": 0}]}]}`

## [tag/Karty-loyalnosti/operation/Выдать карту лояльности](https://developers.yclients.com/ru/\#tag/Karty-loyalnosti/operation/%D0%92%D1%8B%D0%B4%D0%B0%D1%82%D1%8C%20%D0%BA%D0%B0%D1%80%D1%82%D1%83%20%D0%BB%D0%BE%D1%8F%D0%BB%D1%8C%D0%BD%D0%BE%D1%81%D1%82%D0%B8) Выдать карту лояльности

post/loyalty/cards/{company\_id}

https://api.yclients.com/api/v1/loyalty/cards/{company\_id}

| Атрибут | Тип | Описание |
| --- | --- | --- |
| loyalty\_card\_number | number | Номер карты лояльности |
| loyalty\_card\_type\_id | number | Идентификатор типа карты лояльности |
| phone | number | Номер телефона клиента в формате 70001234567 |

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID филиала |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| loyalty\_card\_number | string<br>Номер карты лояльности |
| loyalty\_card\_type\_id | string<br>Идентификатор типа карты лояльности |
| phone | number<br>Номер телефона клиента в формате 70001234567 |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| id | integer<int32><br>Идентификатор карты лояльности |
| balance | number<float><br>Баланс карты лояльности |
| points | integer<int32> |
| paid\_amount | number<float><br>Сумма "Оплачено" |
| sold\_amount | number<float><br>Сумма "Продано" |
| visits\_count | integer<int32><br>Количество визитов |
| number | string<br>Номер карты |
| type\_id | integer<int32><br>Идентификатор типа карты лояльности |
| salon\_group\_id | integer<int32><br>Идентификатор сети, где создана карта |
| type | object<br>Объект, содержащий в себе поля "id" и "title": идентификатор типа карты и название типа карты, соотвественно |
| salon\_group | object<br>Объект, содержащий в себе поля "id" и "title": идентификатор сети, где создан тип карты и название этой сети |
| programs | Array of objects<br>Массив с информацией об акциях, привязанных к карте лояльности |

### Request samples

- Payload

Content type

application/json

Copy

`{
"loyalty_card_number": 9090909,
"loyalty_card_type_id": "8230",
"phone": 79091552422}`

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"id": 9250498,
"balance": 0,
"points": 0,
"paid_amount": 16300,
"sold_amount": 19320,
"visits_count": 5,
"number": "01010101",
"type_id": 8230,
"salon_group_id": 145071,
"type": {
"id": 8230,
"title": "кешмеш",
"salon_group_id": 145071},
"salon_group": {
"id": 145071,
"title": "Сеть тесто1."},
"programs": [\
{\
"id": 12720,\
"title": "накопительный кэш оплачено",\
"value": 10,\
"loyalty_type_id": 7,\
"item_type_id": 0,\
"value_unit_id": 1,\
"group_id": 145071,\
"loyalty_type": {\
"id": 7,\
"title": "Накопительный кэшбэк (оплачено)",\
"is_discount": false,\
"is_cashback": true,\
"is_static": false,\
"is_accumulative": true},\
"rules": [\
{\
"id": 71149,\
"loyalty_program_id": 12720,\
"loyalty_type_id": 7,\
"value": 10,\
"parameter": 100}]}]}`

## [tag/Karty-loyalnosti/operation/Удалить карту  лояльности](https://developers.yclients.com/ru/\#tag/Karty-loyalnosti/operation/%D0%A3%D0%B4%D0%B0%D0%BB%D0%B8%D1%82%D1%8C%20%D0%BA%D0%B0%D1%80%D1%82%D1%83%20%20%D0%BB%D0%BE%D1%8F%D0%BB%D1%8C%D0%BD%D0%BE%D1%81%D1%82%D0%B8) Удалить карту лояльности

delete/loyalty/cards/{company\_id}/{card\_id}

https://api.yclients.com/api/v1/loyalty/cards/{company\_id}/{card\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID филиала |
| card\_id<br>required | number<br>ID карты лояльности |

### Responses

**204**
No Content

## [tag/Karty-loyalnosti/operation/api.chain.loyalty.cards.create_manual_transaction](https://developers.yclients.com/ru/\#tag/Karty-loyalnosti/operation/api.chain.loyalty.cards.create_manual_transaction) Ручное списание/пополнение карты лояльности в сети

post/chain/{chain\_id}/loyalty/cards/{card\_id}/manual\_transaction

https://api.yclients.com/api/v1/chain/{chain\_id}/loyalty/cards/{card\_id}/manual\_transaction

Ручное списание/пополнение карты лояльности в сети

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| chain\_id<br>required | number<br>Example:123<br>Идентификатор сети. |
| card\_id<br>required | number<br>ID карты лояльности |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| amount<br>required | number<br>Сумма списания/пополнения. Положительная для пополнения, отрицательная для списания. |
| title | string<br>Примечание к транзакции. |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object (loyalty\_card) <br>Карта лояльности |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

### Request samples

- Payload

Content type

application/json

Copy

`{
"amount": 100.5,
"title": "string"}`

### Response samples

- 200
- 403
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 0,
"balance": 0,
"points": 0,
"paid_amount": 0,
"sold_amount": 0,
"visits_count": 0,
"number": "string",
"type_id": 0,
"salon_group_id": 0,
"max_discount_percent": 0,
"max_discount_amount": 0},
"meta": { }}`

## [tag/Karty-loyalnosti/paths/~1chain~1{chain_id}~1loyalty~1card_types/get](https://developers.yclients.com/ru/\#tag/Karty-loyalnosti/paths/~1chain~1{chain_id}~1loyalty~1card_types/get) Получить список типов карт, доступных в сети

get/chain/{chain\_id}/loyalty/card\_types

https://api.yclients.com/api/v1/chain/{chain\_id}/loyalty/card\_types

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| chain\_id<br>required | integer<br>Идентификатор сети |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

Array

|     |     |
| --- | --- |
| id | integer<int32><br>Идентификатор типа карты |
| title | string<br>Название типа карты |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`[\
{\
"id": 123,\
"title": "Тип карты лояльности"}]`

## [tag/Karty-loyalnosti/operation/api.company.loyalty.cards.create_manual_transaction](https://developers.yclients.com/ru/\#tag/Karty-loyalnosti/operation/api.company.loyalty.cards.create_manual_transaction) Ручное списание/пополнение карты лояльности в компании

post/company/{company\_id}/loyalty/cards/{card\_id}/manual\_transaction

https://api.yclients.com/api/v1/company/{company\_id}/loyalty/cards/{card\_id}/manual\_transaction

Ручное списание/пополнение карты лояльности в компании

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |
| card\_id<br>required | number<br>ID карты лояльности |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| amount<br>required | number<br>Сумма списания/пополнения. Положительная для пополнения, отрицательная для списания. |
| title | string<br>Примечание к транзакции. |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object (loyalty\_card) <br>Карта лояльности |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

### Request samples

- Payload

Content type

application/json

Copy

`{
"amount": 100.5,
"title": "string"}`

### Response samples

- 200
- 403
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 0,
"balance": 0,
"points": 0,
"paid_amount": 0,
"sold_amount": 0,
"visits_count": 0,
"number": "string",
"type_id": 0,
"salon_group_id": 0,
"max_discount_percent": 0,
"max_discount_amount": 0},
"meta": { }}`

## [tag/Karty-loyalnosti/operation/Получить список типов карт доступных для выдачи клиенту](https://developers.yclients.com/ru/\#tag/Karty-loyalnosti/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%BE%D0%BA%20%D1%82%D0%B8%D0%BF%D0%BE%D0%B2%20%D0%BA%D0%B0%D1%80%D1%82%20%D0%B4%D0%BE%D1%81%D1%82%D1%83%D0%BF%D0%BD%D1%8B%D1%85%20%D0%B4%D0%BB%D1%8F%20%D0%B2%D1%8B%D0%B4%D0%B0%D1%87%D0%B8%20%D0%BA%D0%BB%D0%B8%D0%B5%D0%BD%D1%82%D1%83) Получить список типов карт доступных для выдачи клиенту

get/loyalty/card\_types/client/{company\_id}/{phone}

https://api.yclients.com/api/v1/loyalty/card\_types/client/{company\_id}/{phone}

Возвращает список типов карт, которые доступны для выдачи клиенту салона.

| Атрибут | Тип | Описание |
| --- | --- | --- |
| id | int | Идентификатор типа карты |
| title | string | Название типа карты |
| salon\_group\_id | int | Идентификатор сети, где создан тип карты |
| salon\_group | object | Объект, содержащий в себе поля "id" и "title": идентификатор сети, где создан тип карты и название этой сети |

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:12345<br>ID компании |
| phone<br>required | number<br>Example:70001234567<br>Номер телефона клиента |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

Array

|     |     |
| --- | --- |
| id | integer<int32><br>Идентификатор типа карты |
| title | string<br>Название типа карты |
| salon\_group\_id | integer<int32><br>Идентификатор сети, где создан тип карты |
| salon\_group | object<br>Объект, содержащий в себе поля "id" и "title": идентификатор сети, где создан тип карты и название этой сети |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`[\
{\
"id": 10992,\
"title": "Кэшбек",\
"salon_group_id": 145071,\
"salon_group": {\
"id": 145071,\
"title": "Сеть 1"}},\
{\
"id": 8230,\
"title": "Реферальная программа",\
"salon_group_id": 145071,\
"salon_group": {\
"id": 145071,\
"title": "Сеть 1"}}]`

# [tag/Sertifikaty](https://developers.yclients.com/ru/\#tag/Sertifikaty) Сертификаты

## [tag/Sertifikaty/operation/Получить сертификаты клиента](https://developers.yclients.com/ru/\#tag/Sertifikaty/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%B5%D1%80%D1%82%D0%B8%D1%84%D0%B8%D0%BA%D0%B0%D1%82%D1%8B%20%D0%BA%D0%BB%D0%B8%D0%B5%D0%BD%D1%82%D0%B0) Получить сертификаты клиента

get/loyalty/certificates/

https://api.yclients.com/api/v1/loyalty/certificates/

Возвращает список сертификатов клиента по телефону

| Атрибут | Тип | Описание |
| --- | --- | --- |
| id | int | Идентификатор сертификата |
| number | string | Код сертификата |
| balance | decimal | Текущий баланс |
| default\_balance | decimal | Начальный баланс |
| type\_id | int | Идентификатор типа сертификата |
| status\_id | int | Идентификатор статуса |
| created\_date | datetime | Дата продажи |
| expiration\_date | datetime | Дата сгорания |
| type | object | Объект с информацией о типе сертификата |
| status | object | Объект с информацией о текущем статусе сертификата |

Массив type содержит следующие объекты:

| Атрибут | Тип | Описание |
| --- | --- | --- |
| id | int | Идентификатор типа сертификата |
| title | string | Название типа |
| balance | decimal | Номинал сертификата |
| is\_multi | boolean | Доступен ли для многократрного списания |
| company\_group\_id | int | Идентификатор сети, где создан тип сертификата |
| item\_type\_id | int | Ограничение применения списания баллов. 0 - без ограничений, 1 - Только услуги, 2 - Некоторые услуги + все товары, 3 - Некоторые услуги, 4 - Только товары |
| expiration\_type\_id | int | Идентификатор ограничения срока действия. 0 - без ограничения, 1 - фиксированная дата, 2 - фиксированный срок |
| expiration\_date | datetime | Дата сгорания всех сертифкатов. Заполняется с expiration\_type\_id = 1 |
| expiration\_timeout | int | Срок действия сертифкатов. Заполняется с expiration\_type\_id = 2 |
| expiration\_timeout\_unit\_id | int | Единицы измерения времени. 1 - День, 2 - Неделя, 3 - месяц, 4 - год |
| is\_allow\_empty\_code | boolean | Продажа без кода |
| item\_type | object | Объект с item\_type\_id и его названием |

##### Authorizations:

(_bearer__user_)

##### query Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Идентификатор филиала |
| phone<br>required | number<br>Номер телефона клиента |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | object<br>Метаданные (содержит количество найденных сертификатов) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 409726,\
"number": "888",\
"balance": 9000,\
"default_balance": 9000,\
"type_id": 27841,\
"status_id": 2,\
"created_date": "2020-01-01T15:30:21+04:00",\
"expiration_date": "2020-02-30T15:30:21+04:00",\
"type": {\
"id": 27841,\
"title": "сертификат 9000",\
"balance": 9000,\
"is_multi": true,\
"company_group_id": 128284,\
"item_type_id": 0,\
"expiration_type_id": 2,\
"expiration_timeout": 365,\
"expiration_timeout_unit_id": 1,\
"is_allow_empty_code": false,\
"item_type": {\
"id": 0,\
"title": "Без ограничений"}},\
"status": {\
"id": 2,\
"title": "Активирован"}}],
"meta": {
"count": 1}}`

## [tag/Sertifikaty/operation/Получить сертификаты пользователя](https://developers.yclients.com/ru/\#tag/Sertifikaty/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%B5%D1%80%D1%82%D0%B8%D1%84%D0%B8%D0%BA%D0%B0%D1%82%D1%8B%20%D0%BF%D0%BE%D0%BB%D1%8C%D0%B7%D0%BE%D0%B2%D0%B0%D1%82%D0%B5%D0%BB%D1%8F) Получить сертификаты пользователя

get/user/loyalty/certificates/

https://api.yclients.com/api/v1/user/loyalty/certificates/

Возвращает список сертификатов авторизованного пользователя

##### Authorizations:

(_bearer__user_)

##### query Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Идентификатор филиала |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | object<br>Метаданные (содержит количество найденных сертификатов) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 409726,\
"number": "888",\
"balance": 9000,\
"default_balance": 9000,\
"type_id": 27841,\
"status_id": 2,\
"created_date": "2020-01-01T15:30:21+04:00",\
"expiration_date": "2020-02-30T15:30:21+04:00",\
"type": {\
"id": 27841,\
"title": "сертификат 9000",\
"balance": 9000,\
"is_multi": true,\
"company_group_id": 128284,\
"item_type_id": 0,\
"expiration_type_id": 2,\
"expiration_timeout": 365,\
"expiration_timeout_unit_id": 1,\
"is_allow_empty_code": false,\
"item_type": {\
"id": 0,\
"title": "Без ограничений"}},\
"status": {\
"id": 2,\
"title": "Активирован"}}],
"meta": {
"count": 1}}`

# [tag/Abonementy](https://developers.yclients.com/ru/\#tag/Abonementy) Абонементы

| Атрибут | Тип | Описание |
| --- | --- | --- |
| is\_frozen | boolean | Указывает заморожен ли абонемент |
| freeze\_period | int | Период, который абонемент был заморожен |
| period | int | Значение срока действия абонемента |
| period\_unit\_id | int | Идентификатор единиц измерения срока действия. 1 - день, 2 - неделя, 3 - месяц, 4 - год |
| expiration\_date | datetime | Дата сгорания абонемента |
| status | int | Текущий статус абонемента |
| balance\_container | object | Объект включающий в себя массив links с информацией о балансе абонемента |
| type | object | Объект с информацией о типе абонемента |
| allow\_freeze | boolean | Допускается ли заморозка (для объекта type) |
| is\_allow\_empty\_code | boolean | Допускается ли продажа без кода (для объекта type) |

## [tag/Abonementy/operation/Заморозить абонемент](https://developers.yclients.com/ru/\#tag/Abonementy/operation/%D0%97%D0%B0%D0%BC%D0%BE%D1%80%D0%BE%D0%B7%D0%B8%D1%82%D1%8C%20%D0%B0%D0%B1%D0%BE%D0%BD%D0%B5%D0%BC%D0%B5%D0%BD%D1%82) Заморозить абонемент

post/chain/{chain\_id}/loyalty/abonements/{abonementId}/freeze

https://api.yclients.com/api/v1/chain/{chain\_id}/loyalty/abonements/{abonementId}/freeze

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| chain\_id<br>required | number<br>Example:123<br>Идентификатор сети. |
| abonementId<br>required | number<br>Example:123<br>Идентификатор абонемента. |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| freeze\_till<br>required | string<br>Дата, до которой будет заморожен абонемент. |

### Responses

**200**
OK

**400**
Bad Request

### Request samples

- Payload

Content type

application/json

Copy

`{
"freeze_till": "string"}`

### Response samples

- 200
- 400

Content type

application/json

Copy
Expand all  Collapse all

`[\
{\
"success": "true",\
"data": [\
{\
"id": 123,\
"number": 123456,\
"balance_string": "Услуги (х5)",\
"created_date": 1630064891,\
"activated_date": 1629792900,\
"is_frozen": false,\
"freeze_period": 0,\
"period": 0,\
"period_unit_id": 1,\
"status": {\
"id": 2,\
"title": "Активирован",\
"extended_title": "Активирован"},\
"is_united_balance": false,\
"united_balance_services_count": 0,\
"balance_container": {\
"links": [\
{\
"count": 9,\
"category": {\
"id": 7182839,\
"category_id": 1,\
"title": "Услуги"}}]},\
"type": {\
"id": 896,\
"salon_group_id": 279982,\
"title": "Абонемент на все",\
"period": 0,\
"period_unit_id": 1,\
"allow_freeze": true,\
"freeze_limit": 0,\
"is_allow_empty_code": true,\
"is_united_balance": false,\
"united_balance_services_count": 0,\
"is_code_required": false,\
"balance_container": {\
"links": [\
{\
"count": 10,\
"category": {\
"id": 7182839,\
"category_id": 1,\
"title": "Услуги"}}]}}}],\
"meta": {\
"count": 1}}]`

## [tag/Abonementy/operation/Разморозить абонемент](https://developers.yclients.com/ru/\#tag/Abonementy/operation/%D0%A0%D0%B0%D0%B7%D0%BC%D0%BE%D1%80%D0%BE%D0%B7%D0%B8%D1%82%D1%8C%20%D0%B0%D0%B1%D0%BE%D0%BD%D0%B5%D0%BC%D0%B5%D0%BD%D1%82) Разморозить абонемент

post/chain/{chain\_id}/loyalty/abonements/{abonementId}/unfreeze

https://api.yclients.com/api/v1/chain/{chain\_id}/loyalty/abonements/{abonementId}/unfreeze

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| chain\_id<br>required | number<br>Example:123<br>Идентификатор сети. |
| abonementId<br>required | number<br>Example:123<br>Идентификатор абонемента. |

### Responses

**200**
OK

**400**
Bad Request

### Response samples

- 200
- 400

Content type

application/json

Copy
Expand all  Collapse all

`[\
{\
"success": "true",\
"data": [\
{\
"id": 123,\
"number": 123456,\
"balance_string": "Услуги (х5)",\
"created_date": 1630064891,\
"activated_date": 1629792900,\
"is_frozen": false,\
"freeze_period": 0,\
"period": 0,\
"period_unit_id": 1,\
"status": {\
"id": 2,\
"title": "Активирован",\
"extended_title": "Активирован"},\
"is_united_balance": false,\
"united_balance_services_count": 0,\
"balance_container": {\
"links": [\
{\
"count": 9,\
"category": {\
"id": 7182839,\
"category_id": 1,\
"title": "Услуги"}}]},\
"type": {\
"id": 896,\
"salon_group_id": 279982,\
"title": "Абонемент на все",\
"period": 0,\
"period_unit_id": 1,\
"allow_freeze": true,\
"freeze_limit": 0,\
"is_allow_empty_code": true,\
"is_united_balance": false,\
"united_balance_services_count": 0,\
"is_code_required": false,\
"balance_container": {\
"links": [\
{\
"count": 10,\
"category": {\
"id": 7182839,\
"category_id": 1,\
"title": "Услуги"}}]}}}],\
"meta": {\
"count": 1}}]`

## [tag/Abonementy/operation/Изменить длительность абонемента](https://developers.yclients.com/ru/\#tag/Abonementy/operation/%D0%98%D0%B7%D0%BC%D0%B5%D0%BD%D0%B8%D1%82%D1%8C%20%D0%B4%D0%BB%D0%B8%D1%82%D0%B5%D0%BB%D1%8C%D0%BD%D0%BE%D1%81%D1%82%D1%8C%20%D0%B0%D0%B1%D0%BE%D0%BD%D0%B5%D0%BC%D0%B5%D0%BD%D1%82%D0%B0) Изменить длительность абонемента

post/chain/{chain\_id}/loyalty/abonements/{abonementId}/set\_period

https://api.yclients.com/api/v1/chain/{chain\_id}/loyalty/abonements/{abonementId}/set\_period

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| chain\_id<br>required | number<br>Example:123<br>Идентификатор сети. |
| abonementId<br>required | number<br>Example:123<br>Идентификатор абонемента. |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| period<br>required | number<br>Длительность периода |
| period\_unit\_id<br>required | number<br>Тип периода (1 - день, 2 - неделя, 3 - месяц, 4 - год) |

### Responses

**200**
OK

**400**
Bad Request

### Request samples

- Payload

Content type

application/json

Copy

`{
"period": 0,
"period_unit_id": 0}`

### Response samples

- 200
- 400

Content type

application/json

Copy
Expand all  Collapse all

`[\
{\
"success": "true",\
"data": [\
{\
"id": 123,\
"number": 123456,\
"balance_string": "Услуги (х5)",\
"created_date": 1630064891,\
"activated_date": 1629792900,\
"is_frozen": false,\
"freeze_period": 0,\
"period": 0,\
"period_unit_id": 1,\
"status": {\
"id": 2,\
"title": "Активирован",\
"extended_title": "Активирован"},\
"is_united_balance": false,\
"united_balance_services_count": 0,\
"balance_container": {\
"links": [\
{\
"count": 9,\
"category": {\
"id": 7182839,\
"category_id": 1,\
"title": "Услуги"}}]},\
"type": {\
"id": 896,\
"salon_group_id": 279982,\
"title": "Абонемент на все",\
"period": 0,\
"period_unit_id": 1,\
"allow_freeze": true,\
"freeze_limit": 0,\
"is_allow_empty_code": true,\
"is_united_balance": false,\
"united_balance_services_count": 0,\
"is_code_required": false,\
"balance_container": {\
"links": [\
{\
"count": 10,\
"category": {\
"id": 7182839,\
"category_id": 1,\
"title": "Услуги"}}]}}}],\
"meta": {\
"count": 1}}]`

## [tag/Abonementy/operation/Изменить количество использований абонемента](https://developers.yclients.com/ru/\#tag/Abonementy/operation/%D0%98%D0%B7%D0%BC%D0%B5%D0%BD%D0%B8%D1%82%D1%8C%20%D0%BA%D0%BE%D0%BB%D0%B8%D1%87%D0%B5%D1%81%D1%82%D0%B2%D0%BE%20%D0%B8%D1%81%D0%BF%D0%BE%D0%BB%D1%8C%D0%B7%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D0%B9%20%D0%B0%D0%B1%D0%BE%D0%BD%D0%B5%D0%BC%D0%B5%D0%BD%D1%82%D0%B0) Изменить количество использований абонемента

post/chain/{chain\_id}/loyalty/abonements/{abonementId}/set\_balance

https://api.yclients.com/api/v1/chain/{chain\_id}/loyalty/abonements/{abonementId}/set\_balance

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| chain\_id<br>required | number<br>Example:123<br>Идентификатор сети. |
| abonementId<br>required | number<br>Example:123<br>Идентификатор абонемента. |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| united\_balance\_services\_count<br>required | number<br>Количество услуг для абонемента с объединенным балансом |
| services\_balance\_count<br>required | Array of objects<br>Перечисление услуга-количество для абонемента с раздельным балансом |

### Responses

**200**
OK

**400**
Bad Request

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"united_balance_services_count": 0,
"services_balance_count": [\
{\
"service_id": 0,\
"balance": 0}]}`

### Response samples

- 400

Content type

application/json

Copy
Expand all  Collapse all

`[\
{\
"success": false,\
"meta": {\
"message": "Нельзя изменить баланс"}}]`

## [tag/Abonementy/operation/Получить список абонементов по фильтру](https://developers.yclients.com/ru/\#tag/Abonementy/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%BE%D0%BA%20%D0%B0%D0%B1%D0%BE%D0%BD%D0%B5%D0%BC%D0%B5%D0%BD%D1%82%D0%BE%D0%B2%20%D0%BF%D0%BE%20%D1%84%D0%B8%D0%BB%D1%8C%D1%82%D1%80%D1%83) Получить список абонементов по фильтру

get/chain/{chain\_id}/loyalty/abonements

https://api.yclients.com/api/v1/chain/{chain\_id}/loyalty/abonements

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| chain\_id<br>required | number<br>Example:123<br>Идентификатор сети. |

##### query Parameters

|     |     |
| --- | --- |
| created\_after | string<br>Example:created\_after=1630454400<br>Дата создания с (фильтр по дате создания). |
| created\_before | string<br>Example:created\_before=1630454400<br>Дата создания по (фильтр по дате создания). |
| abonements\_ids | Array of numbers<br>Список идентификаторов для фильтра. |
| page | number<br>Example:page=1<br>Номер страницы. |
| count | number<br>Example:count=25<br>Количество записей на странице. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

**400**
Bad Request

### Response samples

- 200
- 400

Content type

application/json

Copy
Expand all  Collapse all

`[\
{\
"success": "true",\
"data": [\
{\
"id": 123,\
"number": 123456,\
"balance_string": "Услуги (х5)",\
"created_date": 1630064891,\
"activated_date": 1629792900,\
"is_frozen": false,\
"freeze_period": 0,\
"period": 0,\
"period_unit_id": 1,\
"status": {\
"id": 2,\
"title": "Активирован",\
"extended_title": "Активирован"},\
"is_united_balance": false,\
"united_balance_services_count": 0,\
"balance_container": {\
"links": [\
{\
"count": 9,\
"category": {\
"id": 7182839,\
"category_id": 1,\
"title": "Услуги"}}]},\
"type": {\
"id": 896,\
"salon_group_id": 279982,\
"title": "Абонемент на все",\
"period": 0,\
"period_unit_id": 1,\
"allow_freeze": true,\
"freeze_limit": 0,\
"is_allow_empty_code": true,\
"is_united_balance": false,\
"united_balance_services_count": 0,\
"is_code_required": false,\
"balance_container": {\
"links": [\
{\
"count": 10,\
"category": {\
"id": 7182839,\
"category_id": 1,\
"title": "Услуги"}}]}}},\
{\
"id": 720,\
"number": 208867,\
"balance_string": "Какие-то услуги (x10)",\
"created_date": 1630065019,\
"is_frozen": false,\
"freeze_period": 0,\
"period": 0,\
"period_unit_id": 1,\
"status": {\
"id": 3,\
"title": "Просрочен",\
"extended_title": "Просрочен"},\
"is_united_balance": false,\
"united_balance_services_count": 0,\
"balance_container": {\
"links": [\
{\
"count": 10,\
"category": {\
"id": 7182839,\
"category_id": 1,\
"title": "Какие-то услуги"}}]},\
"type": {\
"id": 897,\
"salon_group_id": 279982,\
"title": "Абонемент на все",\
"period": 0,\
"period_unit_id": 1,\
"allow_freeze": true,\
"freeze_limit": 0,\
"is_allow_empty_code": true,\
"is_united_balance": false,\
"united_balance_services_count": 0,\
"is_code_required": false,\
"balance_container": {\
"links": [\
{\
"count": 10,\
"category": {\
"id": 7182839,\
"category_id": 1,\
"title": "Какие-то услуги"}}]}}}],\
"meta": {\
"count": 2}}]`

## [tag/Abonementy/operation/Получить абонементы клиента](https://developers.yclients.com/ru/\#tag/Abonementy/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D0%B0%D0%B1%D0%BE%D0%BD%D0%B5%D0%BC%D0%B5%D0%BD%D1%82%D1%8B%20%D0%BA%D0%BB%D0%B8%D0%B5%D0%BD%D1%82%D0%B0) Получить абонементы клиента

get/loyalty/abonements/

https://api.yclients.com/api/v1/loyalty/abonements/

Возвращает список абонементов клиента по телефону

##### Authorizations:

(_bearer__user_)

##### query Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Идентификатор филиала |
| phone<br>required | number<br>Номер телефона клиента |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | object<br>Метаданные (содержит количество найденных абонементов) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 659878,\
"number": "788376",\
"balance_string": "Серфинг (x10)",\
"is_frozen": false,\
"freeze_period": 0,\
"period": 9999,\
"period_unit_id": 3,\
"status": {\
"id": 1,\
"title": "Выпущен",\
"extended_title": "Выпущен"},\
"balance_container": {\
"links": [\
{\
"count": 10,\
"category": {\
"id": 3129591,\
"category_id": 1,\
"title": "Серфинг"}}]},\
"type": {\
"id": 97804,\
"salon_group_id": 145071,\
"title": "89999",\
"period": 9999,\
"period_unit_id": 3,\
"allow_freeze": false,\
"freeze_limit": 0,\
"is_allow_empty_code": false,\
"is_united_balance": false,\
"united_balance_services_count": 0,\
"balance_container": {\
"links": [\
{\
"count": 10,\
"category": {\
"id": 3129591,\
"category_id": 1,\
"title": "Серфинг"}}]}}}],
"meta": {
"count": 1}}`

## [tag/Abonementy/operation/Получить абонементы пользователя](https://developers.yclients.com/ru/\#tag/Abonementy/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D0%B0%D0%B1%D0%BE%D0%BD%D0%B5%D0%BC%D0%B5%D0%BD%D1%82%D1%8B%20%D0%BF%D0%BE%D0%BB%D1%8C%D0%B7%D0%BE%D0%B2%D0%B0%D1%82%D0%B5%D0%BB%D1%8F) Получить абонементы пользователя

get/user/loyalty/abonements/

https://api.yclients.com/api/v1/user/loyalty/abonements/

Возвращает список абонементов авторизованного пользователя

##### Authorizations:

(_bearer__user_)

##### query Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Идентификатор филиала |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | object<br>Метаданные (содержит количество найденных абонементов) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 659878,\
"number": "788376",\
"balance_string": "Серфинг (x10)",\
"is_frozen": false,\
"freeze_period": 0,\
"period": 9999,\
"period_unit_id": 3,\
"status": {\
"id": 1,\
"title": "Выпущен",\
"extended_title": "Выпущен"},\
"balance_container": {\
"links": [\
{\
"count": 10,\
"category": {\
"id": 3129591,\
"category_id": 1,\
"title": "Серфинг"}}]},\
"type": {\
"id": 97804,\
"salon_group_id": 145071,\
"title": "89999",\
"period": 9999,\
"period_unit_id": 3,\
"allow_freeze": false,\
"freeze_limit": 0,\
"is_allow_empty_code": false,\
"is_united_balance": false,\
"united_balance_services_count": 0,\
"balance_container": {\
"links": [\
{\
"count": 10,\
"category": {\
"id": 3129591,\
"category_id": 1,\
"title": "Серфинг"}}]}}}],
"meta": {
"count": 1}}`

# [tag/Primenenie-loyalnosti-v-vizite](https://developers.yclients.com/ru/\#tag/Primenenie-loyalnosti-v-vizite) Применение лояльности в визите

| Атрибут | Тип | Описание |
| --- | --- | --- |
| loyalty\_transactions | array | Массив с информацией о примененных транзакциях лояльности в визите |
| is\_discount | boolean | Является ли транзакцией скидки |
| is\_loyalty\_withdraw | boolean | Является ли транзакцией списания баллов |
| items | array | Массив с информацией о товарах и услугах записи |
| payment\_transactions | array | Массив с информацией о финансовых транзакциях записи |
| kkm\_transactions | object | Объект с информацией о ККМ транзакциях записи |

## [tag/Primenenie-loyalnosti-v-vizite/operation/Применить акцию скидки в визите](https://developers.yclients.com/ru/\#tag/Primenenie-loyalnosti-v-vizite/operation/%D0%9F%D1%80%D0%B8%D0%BC%D0%B5%D0%BD%D0%B8%D1%82%D1%8C%20%D0%B0%D0%BA%D1%86%D0%B8%D1%8E%20%D1%81%D0%BA%D0%B8%D0%B4%D0%BA%D0%B8%20%D0%B2%20%D0%B2%D0%B8%D0%B7%D0%B8%D1%82%D0%B5) Применить акцию скидки в визите

post/visit/loyalty/apply\_discount\_program/{company\_id}/{card\_id}/{program\_id}

https://api.yclients.com/api/v1/visit/loyalty/apply\_discount\_program/{company\_id}/{card\_id}/{program\_id}

Применение акции к визиту, имеет смысл тольо если есть визит

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID филиала |
| card\_id<br>required | number<br>ID карты клиента |
| program\_id<br>required | number<br>ID акции, привязанной к карте |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| record\_id<br>required | number<br>Идентификатор записи |
| visit\_id<br>required | number<br>Идентификатор визита |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| payment\_transactions | Array of objects<br>Массив с информацией о финансовых транзакциях записи |
| loyalty\_transactions | Array of objects<br>Массив с информацией о примененных транзакциях лояльности в визите |
| kkm\_transaction\_details\_container | object<br>Объект с информацией о ККМ транзакциях записи |
| items | Array of objects<br>Массив с информацией о товарах и услугах записи |

### Request samples

- Payload

Content type

application/json

Copy

`{
"record_id": 0,
"visit_id": 0}`

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"payment_transactions": [ ],
"loyalty_transactions": [\
{\
"id": 22985556,\
"status_id": 1,\
"amount": 20,\
"type_id": 1,\
"program_id": 20802,\
"card_id": 9223622,\
"salon_group_id": 145071,\
"item_id": 5048384,\
"item_type_id": 7,\
"item_record_id": 0,\
"goods_transaction_id": 96063258,\
"is_discount": true,\
"is_loyalty_withdraw": false,\
"type": {\
"id": 1,\
"title": "Скидка по акции"}}],
"kkm_transaction_details_container": {
"last_operation_type": 1,
"transactions": [ ]},
"items": [\
{\
"id": 96063258,\
"item_id": 5048384,\
"item_type_id": 7,\
"record_id": 0,\
"item_title": "тестовый два",\
"amount": 1,\
"first_cost": 20,\
"manual_cost": 20,\
"discount": 0,\
"cost": 20,\
"master_id": 548096,\
"good_id": 5048384,\
"service_id": 0,\
"event_id": 0,\
"is_service": false,\
"is_event": false,\
"is_good": true},\
{\
"id": 0,\
"item_id": 2560779,\
"item_type_id": 1,\
"record_id": 140878948,\
"item_title": "Глубокое бикини",\
"amount": 1,\
"first_cost": 3000,\
"manual_cost": 3000,\
"discount": 0,\
"cost": 3000,\
"master_id": 140878948,\
"good_id": 0,\
"service_id": 2560779,\
"event_id": 0,\
"is_service": true,\
"is_event": false,\
"is_good": false}]}`

## [tag/Primenenie-loyalnosti-v-vizite/operation/Отменить применение акции скидки в визите](https://developers.yclients.com/ru/\#tag/Primenenie-loyalnosti-v-vizite/operation/%D0%9E%D1%82%D0%BC%D0%B5%D0%BD%D0%B8%D1%82%D1%8C%20%D0%BF%D1%80%D0%B8%D0%BC%D0%B5%D0%BD%D0%B5%D0%BD%D0%B8%D0%B5%20%D0%B0%D0%BA%D1%86%D0%B8%D0%B8%20%D1%81%D0%BA%D0%B8%D0%B4%D0%BA%D0%B8%20%D0%B2%20%D0%B2%D0%B8%D0%B7%D0%B8%D1%82%D0%B5) Отменить применение акции скидки в визите

post/visit/loyalty/cancel\_discount\_program/{company\_id}/{card\_id}/{program\_id}

https://api.yclients.com/api/v1/visit/loyalty/cancel\_discount\_program/{company\_id}/{card\_id}/{program\_id}

Отмена примененной к визиту акции.

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID филиала |
| card\_id<br>required | number<br>ID карты клиента |
| program\_id<br>required | number<br>ID акции, привязанной к карте |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: \*/\*

|     |     |
| --- | --- |
| record\_id<br>required | number<br>Идентификатор записи |
| visit\_id<br>required | number<br>Идентификатор визита |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| payment\_transactions | Array of objects<br>Массив с информацией о финансовых транзакциях записи |
| loyalty\_transactions | Array of objects<br>Массив с информацией о примененных транзакциях лояльности в визите |
| kkm\_transaction\_details\_container | object<br>Объект с информацией о ККМ транзакциях записи |
| items | Array of objects<br>Массив с информацией о товарах и услугах записи |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"payment_transactions": [ ],
"loyalty_transactions": [ ],
"kkm_transaction_details_container": {
"last_operation_type": 1,
"transactions": [ ]},
"items": [\
{\
"id": 96063258,\
"item_id": 5048384,\
"item_type_id": 7,\
"record_id": 0,\
"item_title": "тестовый два",\
"amount": 1,\
"first_cost": 20,\
"manual_cost": 20,\
"discount": 0,\
"cost": 20,\
"master_id": 548096,\
"good_id": 5048384,\
"service_id": 0,\
"event_id": 0,\
"is_service": false,\
"is_event": false,\
"is_good": true},\
{\
"id": 0,\
"item_id": 2560779,\
"item_type_id": 1,\
"record_id": 140878948,\
"item_title": "Глубокое бикини",\
"amount": 1,\
"first_cost": 3000,\
"manual_cost": 3000,\
"discount": 0,\
"cost": 3000,\
"master_id": 140878948,\
"good_id": 0,\
"service_id": 2560779,\
"event_id": 0,\
"is_service": true,\
"is_event": false,\
"is_good": false}]}`

## [tag/Primenenie-loyalnosti-v-vizite/operation/Применить списание с карты лояльности в визите](https://developers.yclients.com/ru/\#tag/Primenenie-loyalnosti-v-vizite/operation/%D0%9F%D1%80%D0%B8%D0%BC%D0%B5%D0%BD%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%B0%D0%BD%D0%B8%D0%B5%20%D1%81%20%D0%BA%D0%B0%D1%80%D1%82%D1%8B%20%D0%BB%D0%BE%D1%8F%D0%BB%D1%8C%D0%BD%D0%BE%D1%81%D1%82%D0%B8%20%D0%B2%20%D0%B2%D0%B8%D0%B7%D0%B8%D1%82%D0%B5) Применить списание с карты лояльности в визите

post/visit/loyalty/apply\_card\_withdrawal/{company\_id}/{card\_id}

https://api.yclients.com/api/v1/visit/loyalty/apply\_card\_withdrawal/{company\_id}/{card\_id}

Списание бонусов с карты Сумма не будет превышать остаток на оплату Если 0 то транзакции не будет

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID филиала |
| card\_id<br>required | number<br>ID карты клиента |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: \*/\*

|     |     |
| --- | --- |
| record\_id<br>required | number<br>Идентификатор записи |
| visit\_id<br>required | number<br>Идентификатор визита |
| amount<br>required | number<br>Количество баллов для списания |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| payment\_transactions | Array of objects<br>Массив с информацией о финансовых транзакциях записи |
| loyalty\_transactions | Array of objects<br>Массив с информацией о примененных транзакциях лояльности в визите |
| kkm\_transaction\_details\_container | object<br>Объект с информацией о ККМ транзакциях записи |
| items | Array of objects<br>Массив с информацией о товарах и услугах записи |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"payment_transactions": [ ],
"loyalty_transactions": [\
{\
"id": 22985556,\
"status_id": 1,\
"amount": 20,\
"type_id": 1,\
"program_id": 20802,\
"card_id": 9223622,\
"salon_group_id": 145071,\
"item_id": 5048384,\
"item_type_id": 7,\
"item_record_id": 0,\
"goods_transaction_id": 96063258,\
"is_discount": true,\
"is_loyalty_withdraw": false,\
"type": {\
"id": 1,\
"title": "Скидка по акции"}}],
"kkm_transaction_details_container": {
"last_operation_type": 1,
"transactions": [ ]},
"items": [\
{\
"id": 96063258,\
"item_id": 5048384,\
"item_type_id": 7,\
"record_id": 0,\
"item_title": "тестовый два",\
"amount": 1,\
"first_cost": 20,\
"manual_cost": 20,\
"discount": 0,\
"cost": 20,\
"master_id": 548096,\
"good_id": 5048384,\
"service_id": 0,\
"event_id": 0,\
"is_service": false,\
"is_event": false,\
"is_good": true},\
{\
"id": 0,\
"item_id": 2560779,\
"item_type_id": 1,\
"record_id": 140878948,\
"item_title": "Глубокое бикини",\
"amount": 1,\
"first_cost": 3000,\
"manual_cost": 3000,\
"discount": 0,\
"cost": 3000,\
"master_id": 140878948,\
"good_id": 0,\
"service_id": 2560779,\
"event_id": 0,\
"is_service": true,\
"is_event": false,\
"is_good": false}]}`

## [tag/Primenenie-loyalnosti-v-vizite/operation/Отменить списание с карты лояльности в визите](https://developers.yclients.com/ru/\#tag/Primenenie-loyalnosti-v-vizite/operation/%D0%9E%D1%82%D0%BC%D0%B5%D0%BD%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%B0%D0%BD%D0%B8%D0%B5%20%D1%81%20%D0%BA%D0%B0%D1%80%D1%82%D1%8B%20%D0%BB%D0%BE%D1%8F%D0%BB%D1%8C%D0%BD%D0%BE%D1%81%D1%82%D0%B8%20%D0%B2%20%D0%B2%D0%B8%D0%B7%D0%B8%D1%82%D0%B5) Отменить списание с карты лояльности в визите

post/visit/loyalty/cancel\_card\_withdrawal/{company\_id}/{card\_id}

https://api.yclients.com/api/v1/visit/loyalty/cancel\_card\_withdrawal/{company\_id}/{card\_id}

Отмена списания с карты лояльности.

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID филиала |
| card\_id<br>required | number<br>ID карты клиента |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: \*/\*

|     |     |
| --- | --- |
| record\_id<br>required | number<br>Идентификатор записи |
| visit\_id<br>required | number<br>Идентификатор визита |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| payment\_transactions | Array of objects<br>Массив с информацией о финансовых транзакциях записи |
| loyalty\_transactions | Array of objects<br>Массив с информацией о примененных транзакциях лояльности в визите |
| kkm\_transaction\_details\_container | object<br>Объект с информацией о ККМ транзакциях записи |
| items | Array of objects<br>Массив с информацией о товарах и услугах записи |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"payment_transactions": [ ],
"loyalty_transactions": [ ],
"kkm_transaction_details_container": {
"last_operation_type": 1,
"transactions": [ ]},
"items": [\
{\
"id": 96063258,\
"item_id": 5048384,\
"item_type_id": 7,\
"record_id": 0,\
"item_title": "тестовый два",\
"amount": 1,\
"first_cost": 20,\
"manual_cost": 20,\
"discount": 0,\
"cost": 20,\
"master_id": 548096,\
"good_id": 5048384,\
"service_id": 0,\
"event_id": 0,\
"is_service": false,\
"is_event": false,\
"is_good": true},\
{\
"id": 0,\
"item_id": 2560779,\
"item_type_id": 1,\
"record_id": 140878948,\
"item_title": "Глубокое бикини",\
"amount": 1,\
"first_cost": 3000,\
"manual_cost": 3000,\
"discount": 0,\
"cost": 3000,\
"master_id": 140878948,\
"good_id": 0,\
"service_id": 2560779,\
"event_id": 0,\
"is_service": true,\
"is_event": false,\
"is_good": false}]}`

## [tag/Primenenie-loyalnosti-v-vizite/operation/Применить реферальную программу в записи](https://developers.yclients.com/ru/\#tag/Primenenie-loyalnosti-v-vizite/operation/%D0%9F%D1%80%D0%B8%D0%BC%D0%B5%D0%BD%D0%B8%D1%82%D1%8C%20%D1%80%D0%B5%D1%84%D0%B5%D1%80%D0%B0%D0%BB%D1%8C%D0%BD%D1%83%D1%8E%20%D0%BF%D1%80%D0%BE%D0%B3%D1%80%D0%B0%D0%BC%D0%BC%D1%83%20%D0%B2%20%D0%B7%D0%B0%D0%BF%D0%B8%D1%81%D0%B8) Применить реферальную программу в записи

post/visit/loyalty/apply\_referral\_program/{company\_id}/{group\_id}

https://api.yclients.com/api/v1/visit/loyalty/apply\_referral\_program/{company\_id}/{group\_id}

Применение реферальной программы к визиту

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID филиала |
| group\_id<br>required | number<br>ID сети, где настроена реферальная программа |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: \*/\*

|     |     |
| --- | --- |
| record\_id<br>required | number<br>Идентификатор записи |
| visit\_id<br>required | number<br>Идентификатор визита |
| referrer\_phone<br>required | number<br>Номер телефона пригласившего |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| payment\_transactions | Array of objects<br>Массив с информацией о финансовых транзакциях записи |
| loyalty\_transactions | Array of objects<br>Массив с информацией о примененных транзакциях лояльности в визите |
| kkm\_transaction\_details\_container | object<br>Объект с информацией о ККМ транзакциях записи |
| items | Array of objects<br>Массив с информацией о товарах и услугах записи |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"payment_transactions": [ ],
"loyalty_transactions": [\
{\
"id": 22989715,\
"status_id": 1,\
"amount": 100,\
"type_id": 1,\
"program_id": 12705,\
"card_id": 0,\
"salon_group_id": 145071,\
"item_id": 5048371,\
"item_type_id": 7,\
"item_record_id": 0,\
"goods_transaction_id": 96082477,\
"is_discount": true,\
"is_loyalty_withdraw": false,\
"type": {\
"id": 1,\
"title": "Скидка по акции"}}],
"kkm_transaction_details_container": {
"last_operation_type": 1,
"transactions": [ ]},
"items": [\
{\
"id": 96082477,\
"item_id": 5048371,\
"item_type_id": 7,\
"record_id": 0,\
"item_title": "тестовый",\
"amount": 1,\
"first_cost": 1000,\
"manual_cost": 1000,\
"discount": 0,\
"cost": 1000,\
"master_id": 548042,\
"good_id": 5048371,\
"service_id": 0,\
"event_id": 0,\
"is_service": false,\
"is_event": false,\
"is_good": true}]}`

## [tag/Primenenie-loyalnosti-v-vizite/operation/Получить транзакции лояльности по визиту](https://developers.yclients.com/ru/\#tag/Primenenie-loyalnosti-v-vizite/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%82%D1%80%D0%B0%D0%BD%D0%B7%D0%B0%D0%BA%D1%86%D0%B8%D0%B8%20%D0%BB%D0%BE%D1%8F%D0%BB%D1%8C%D0%BD%D0%BE%D1%81%D1%82%D0%B8%20%D0%BF%D0%BE%20%D0%B2%D0%B8%D0%B7%D0%B8%D1%82%D1%83) Получить транзакции лояльности по визиту

get/visit/loyalty/transactions/{visit\_id}

https://api.yclients.com/api/v1/visit/loyalty/transactions/{visit\_id}

Список транзакций по акциям лояльнсти для данного визита

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| visit\_id<br>required | number<br>ID визита |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

Array

|     |     |
| --- | --- |
| id | integer<int32><br>Идентификатор транзакции лояльности |
| status\_id | integer<int32><br>Идентификатор статуса |
| amount | number<float><br>Сумма транзакции |
| type\_id | integer<int32><br>Идентификатор типа транзакции |
| program\_id | integer<int32><br>Идентификатор программы лояльности |
| card\_id | integer<int32><br>Идентификатор карты лояльности |
| salon\_group\_id | integer<int32><br>Идентификатор сети, которой принадлежит лояльность |
| item\_id | integer<int32><br>Идентификатор товара/услуги, к которой применяется акция |
| item\_type\_id | integer<int32><br>Идентификатор типа операции |
| item\_record\_id | integer<int32><br>Идентификатор записи, которой принадлежит услуга/товар |
| goods\_transaction\_id | integer<int32><br>Идентификатор товарной транзакции |
| is\_discount | boolean<br>Является ли скидкой |
| is\_loyalty\_withdraw | boolean<br>Отменено ли применение лояльности |
| type | object<br>Тип лояльности |
| program | object<br>Информация об акции |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`[\
{\
"id": 22989715,\
"status_id": 1,\
"amount": 100,\
"type_id": 1,\
"program_id": 12705,\
"card_id": 0,\
"salon_group_id": 145071,\
"item_id": 5048371,\
"item_type_id": 7,\
"item_record_id": 0,\
"goods_transaction_id": 96082477,\
"is_discount": true,\
"is_loyalty_withdraw": false,\
"type": {\
"id": 1,\
"title": "Скидка по акции"},\
"program": {\
"id": 12705,\
"title": "приглашенный",\
"value": 10,\
"loyalty_type_id": 1,\
"item_type_id": 0,\
"value_unit_id": 1,\
"group_id": 145071}},\
{\
"id": 22994127,\
"status_id": 1,\
"amount": 100,\
"type_id": 4,\
"program_id": 19044,\
"card_id": 9234863,\
"salon_group_id": 145071,\
"item_id": 0,\
"item_type_id": 0,\
"item_record_id": 0,\
"goods_transaction_id": 0,\
"is_discount": false,\
"is_loyalty_withdraw": false,\
"type": {\
"id": 4,\
"title": "Начисление по реферальной программе"},\
"program": {\
"id": 19044,\
"title": "пригласивший 2",\
"value": 100,\
"loyalty_type_id": 6,\
"item_type_id": 0,\
"value_unit_id": 2,\
"group_id": 145071}}]`

# [tag/Spravochniki](https://developers.yclients.com/ru/\#tag/Spravochniki) Справочники

## [section/Poluchenie-spiska-biznes-tipov-sgruppirovannyh-po-gruppam](https://developers.yclients.com/ru/\#section/Poluchenie-spiska-biznes-tipov-sgruppirovannyh-po-gruppam) Получение списка бизнес-типов сгруппированных по группам

Объект бизнес-группы имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | ID категории |
| title | string | Название категории |
| image | string | Изображение группы |
| types | array | Связанные бизнес-типы |

Объект бизнес-типа имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | ID типа |
| title | string | Название типа |
| business\_group\_id | number | ID бизнес-группы |

## [tag/Spravochniki/operation/Получить бизнес-типы по группам](https://developers.yclients.com/ru/\#tag/Spravochniki/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D0%B1%D0%B8%D0%B7%D0%BD%D0%B5%D1%81-%D1%82%D0%B8%D0%BF%D1%8B%20%D0%BF%D0%BE%20%D0%B3%D1%80%D1%83%D0%BF%D0%BF%D0%B0%D0%BC) Получить бизнес-типы по группам

get/references/business\_groups\_with\_types

https://api.yclients.com/api/v1/references/business\_groups\_with\_types

##### Authorizations:

(_bearer__user_)

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | object<br>Метаданные (содержит количество найденых бизнес-типов) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 10,\
"title": "Бытовые услуги",\
"image": "http://u17.dev.yclients.tech/images/business-groups/services.png",\
"types": [\
{\
"id": 31,\
"title": "Ателье",\
"business_group_id": 10}]},\
{\
"id": 1,\
"title": "Красота",\
"image": "http://u17.dev.yclients.tech/images/business-groups/beauty.png",\
"types": [\
{\
"id": 1,\
"title": "Салоны красоты",\
"business_group_id": 1},\
{\
"id": 25,\
"title": "Спа салон",\
"business_group_id": 1}]}],
"meta": {
"count": 10}}`

# [tag/Kategorii](https://developers.yclients.com/ru/\#tag/Kategorii) Категории

Объект категории имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | ID категории |
| salon\_id | number | ID компании |
| title | string | Название категории |
| color | string | Цвет метки в формате #RRGGBB |
| icon | string | Название иконки |
| entity | number | Объект категории (1 - категория для клиентов, 2 - категория для записей) |
| deleted | number | Метка удаления |
| not\_editable | number | Разрешены ли изменения категории (1 - разрешены, 0 - не разрешены) |

## [tag/Kategorii/operation/Получить категории](https://developers.yclients.com/ru/\#tag/Kategorii/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D0%BA%D0%B0%D1%82%D0%B5%D0%B3%D0%BE%D1%80%D0%B8%D0%B8) Получить категории компании

get/labels/{company\_id}/{entity}

https://api.yclients.com/api/v1/labels/{company\_id}/{entity}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| entity<br>required | number<br>Объект категории (0 - общие метки, 1 - метки клиентов, 2 - метки записей) |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

Array

|     |     |
| --- | --- |
| id | number<br>Идентификатор категории |
| salon\_id | number<br>Идентификатор филиала |
| title | string<br>Название категории |
| color | string<br>Цвет метки в формате #RRGGBB |
| icon | string<br>Название иконки |
| entity | number<br>Объект категории (1 - категория для клиентов, 2 - категория для записей) |
| deleted | number<br>Метка удаления |
| not\_editable | number<br>Разрешены ли изменения категории (1 - разрешены, 0 - не разрешены) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`[\
{\
"id": "241625",\
"salon_id": "68570",\
"title": "Сотрудник важен",\
"color": "#ff2828",\
"icon": "lock",\
"entity": "2",\
"deleted": "0",\
"not_editable": "1"},\
{\
"id": "241626",\
"salon_id": "68570",\
"title": "Сотрудник не важен",\
"color": "#009800",\
"icon": "unlock",\
"entity": "2",\
"deleted": "0",\
"not_editable": "1"}]`

## [tag/Kategorii/paths/~1labels~1{company_id}~1clients~1create/post](https://developers.yclients.com/ru/\#tag/Kategorii/paths/~1labels~1{company_id}~1clients~1create/post) Создать клиентскую категорию компании

post/labels/{company\_id}/clients/create

https://api.yclients.com/api/v1/labels/{company\_id}/clients/create

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: \*/\*

|     |     |
| --- | --- |
| title | string<br>Название категории |
| color | string<br>Цвет метки в формате #RRGGBB |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

**400**
Bad Request

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (false) |
| data | string<br>Содержит null |
| meta | object<br>Метаданные (содержит сообщение об ошибке) |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (false) |
| data | string<br>Содержит null |
| meta | object<br>Содержит массив с сообщениями о возможных ошибках |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (false) |
| data | string<br>Содержит null |
| meta | object<br>Содержит массив сообщений о возможных ошибках |

### Response samples

- 200
- 400
- 403
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"title": "Тестовая",
"salon_id": 68570,
"color": "#00ff11",
"entity": 1,
"id": "3599560"},
"meta": [ ]}`

## [tag/Kategorii/operation/Создать категорию](https://developers.yclients.com/ru/\#tag/Kategorii/operation/%D0%A1%D0%BE%D0%B7%D0%B4%D0%B0%D1%82%D1%8C%20%D0%BA%D0%B0%D1%82%D0%B5%D0%B3%D0%BE%D1%80%D0%B8%D1%8E) Создать категорию

post/labels/{company\_id}

https://api.yclients.com/api/v1/labels/{company\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### query Parameters

|     |     |
| --- | --- |
| title<br>required | string<br>Название категории |
| color<br>required | string<br>Цвет метки в формате #RRGGBB |
| entity | number<br>Объект категории (0 - общие метки, 1 - метки клиентов, 2 - метки записей) |
| icon | string<br>Название иконки |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"title": "Тестовая",
"salon_id": 68570,
"color": "#00ff11",
"entity": 1,
"id": "3599560"},
"meta": [ ]}`

## [tag/Kategorii/operation/Обновить категорию](https://developers.yclients.com/ru/\#tag/Kategorii/operation/%D0%9E%D0%B1%D0%BD%D0%BE%D0%B2%D0%B8%D1%82%D1%8C%20%D0%BA%D0%B0%D1%82%D0%B5%D0%B3%D0%BE%D1%80%D0%B8%D1%8E) Обновить категорию

put/labels/{company\_id}/{label\_id}

https://api.yclients.com/api/v1/labels/{company\_id}/{label\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| label\_id<br>required | number<br>ID метки |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| title | string<br>Название категории |
| color | string<br>Цвет метки в формате #RRGGBB |
| entity | number<br>Объект категории (1 - категория для клиентов, 2 - категория для записей) |
| icon | string<br>Название иконки |

### Responses

**202**
Accepted

### Request samples

- Payload

Content type

application/json

Copy

`{
"title": "Тествая2",
"color": "#aa11ff",
"entity": 2,
"icon": "Тест"}`

### Response samples

- 202

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"meta": {
"message": "Accepted"}}`

## [tag/Kategorii/operation/Удалить категорию компании](https://developers.yclients.com/ru/\#tag/Kategorii/operation/%D0%A3%D0%B4%D0%B0%D0%BB%D0%B8%D1%82%D1%8C%20%D0%BA%D0%B0%D1%82%D0%B5%D0%B3%D0%BE%D1%80%D0%B8%D1%8E%20%D0%BA%D0%BE%D0%BC%D0%BF%D0%B0%D0%BD%D0%B8%D0%B8) Удалить категорию компании

delete/labels/{company\_id}/{label\_id}

https://api.yclients.com/api/v1/labels/{company\_id}/{label\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| label\_id<br>required | number<br>ID метки |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"meta": {
"message": "Accepted"}}`

## [tag/Kategorii/operation/Получить клиентские категории с посиком по названию](https://developers.yclients.com/ru/\#tag/Kategorii/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D0%BA%D0%BB%D0%B8%D0%B5%D0%BD%D1%82%D1%81%D0%BA%D0%B8%D0%B5%20%D0%BA%D0%B0%D1%82%D0%B5%D0%B3%D0%BE%D1%80%D0%B8%D0%B8%20%D1%81%20%D0%BF%D0%BE%D1%81%D0%B8%D0%BA%D0%BE%D0%BC%20%D0%BF%D0%BE%20%D0%BD%D0%B0%D0%B7%D0%B2%D0%B0%D0%BD%D0%B8%D1%8E) Получить клиентские категории с поиском по названию

get/labels/{company\_id}/clients

https://api.yclients.com/api/v1/labels/{company\_id}/clients

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID филиала |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив с объектами данных |
| meta | object<br>Метаданные (содержит номер страницы и количество найденных категорий) |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (false) |
| data | string<br>Содержит null |
| meta | object<br>Содержит массив с сообщениями о возможных ошибках |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (false) |
| data | string<br>Содержит null |
| meta | object<br>Содержит массив сообщений о возможных ошибках |

### Response samples

- 200
- 403
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 3,\
"salon_id": 4564,\
"title": "Постоянный клиент",\
"color": "#1f1038",\
"icon": "tag",\
"entity": 1,\
"deleted": 1,\
"not_editable": 0}],
"meta": {
"page": 1,
"total_count": 25}}`

# [tag/Tovary](https://developers.yclients.com/ru/\#tag/Tovary) Товары

## [section/Opisanie-API-obuektov-sushnosti-Tovar](https://developers.yclients.com/ru/\#section/Opisanie-API-obuektov-sushnosti-Tovar) Описание API объектов сущности «Товар»

Объект товара имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| title | string | Наименование товара |
| value | string | Наименование товара |
| print\_title | string | Наименование товара для печати в чеке |
| label | string | Наименование товара с артикулом (если имеется) |
| good\_id | number | Идентификатор товара |
| cost | float | Цена продажи |
| sale\_unit\_id | int | ID единицы измерения для продажи |
| unit\_short\_title | string | Единица измерения для продажи |
| service\_unit\_id | int | ID единицы измерения для списания |
| service\_unit\_short\_title | string | Единица измерения для списания |
| actual\_cost | float | Себестоимость |
| unit\_actual\_cost | float | Себестоимость единицы |
| unit\_actual\_cost\_format | string | Формат себестоимости единицы |
| unit\_equals | float | Отношение единицы измерения для продажик еденице за списание |
| barcode | string | Штрих-код |
| critical\_amount | float | Критчный остаток |
| desired\_amount | float | Желаемый остаток |
| netto | float | Масса нетто |
| brutto | float | Масса брутто |
| tax\_variant | int | СНО |
| vat\_id | int | НДС |
| loyalty\_abonement\_type\_id | int | Идентификатор тип абонемента (если товар является абонементом) |
| loyalty\_certificate\_type\_id | int | Идентификатор тип сертификата (если товар является сертификатом) |
| loyalty\_allow\_empty\_code | boolean | Разрешена ли продажа без кода |
| actual\_amounts | array | Остатки на складах |
| is\_barcode | number | Товар по штрих-коду |
| last\_change\_date | string | Дата последнего изменения сущности |
| comment | string | Комментарий |

Объект из actual\_amounts имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| storage\_id | number | ID склада |
| amount | number | Количество |

Объекты из массива correction\_rules имеют следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| type | int | Тип операции (1 - Продажа товара, 2 - Списание расходников, 3 - Приход товара, 4 - Списание товара, 5 - Перемещение товара) |
| base\_unit | string | Основная единица измерения при корректировке ("sale" - Для продажи, "service" - Для списания) |

Единицы измерения:

| ID | Название | ID | Название | ID | Название |
| --- | --- | --- | --- | --- | --- |
| 216760 | Штука | 216761 | Миллилитр | 216762 | Сертификат |
| 216763 | Грамм | 216764 | Упаковка | 216765 | Миллиграмм |
| 216766 | Сантиметр | 216767 | Микролитр | 216768 | Пара |
| 216769 | Метр | 216770 | Рулон | 216771 | Литр |
| 216772 | Флакон | 216773 | Единица | 216774 | Тюбик |
| 216775 | Минута | 216776 | Килограмм | 216777 | Ампула |
| 216778 | Банка | 216779 | Другое | 216780 | Коробка |
| 216781 | Набор | 216782 | Миллиметры | 216783 | Порция |
| 216784 | Линия | 216785 | Бутылка | 216786 | Шприц |
| 216787 | Процедура | 216788 | Лента | 216789 | Час |
| 216790 | Капсула | 216791 | Доза | 216792 | Рубль |
| 216793 | Километр | 216794 | Гривна | 216795 | Тенге |
| 216796 | Погонный метр |  |  |  |  |

Виды систем налогообложения:

| ID | СНО |
| --- | --- |
| 0 | Общая ОСН |
| 1 | Упрощенная УСН (Доход) |
| 2 | Упрощенная УСН (Доход минус Расход) |
| 3 | Единый налог на вмененный доход ЕНВД |
| 4 | Единый сельскохозяйственный налог ЕСН |
| 5 | Патентная система налогообложения |

Виды НДС:

| ID | НДС |
| --- | --- |
| 1 | 0% |
| 2 | 10% |
| 3 | 20% |
| 4 | Не облагается |

## [tag/Tovary/paths/~1goods~1{company_id}/post](https://developers.yclients.com/ru/\#tag/Tovary/paths/~1goods~1{company_id}/post) Создать товар

post/goods/{company\_id}

https://api.yclients.com/api/v1/goods/{company\_id}

Метод позволяет создать товар

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Идентификатор филиала |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| title<br>required | string<br>Название товара |
| print\_title | string<br>Название для печати в чеке |
| article | string<br>Артикул |
| barcode | string<br>Штрих-код |
| category\_id<br>required | integer<br>Идентификатор категории товара |
| cost | number<float><br>Цена продажи |
| actual\_cost | number<float><br>Себестоимость |
| sale\_unit\_id<br>required | integer<br>Единица измерения для продажи |
| service\_unit\_id<br>required | integer<br>Единица измерения для списания |
| unit\_equals | number<float><br>Отношение ед.имзерения для продажи к ед.измерения для списания |
| critical\_amount | number<float><br>Критичный остаток |
| desired\_amount | number<float><br>Желаемый остаток |
| netto | number<float><br>Масса нетто |
| brutto | number<float><br>Масса брутто |
| comment | string<br>Комментарий |
| tax\_variant | integer<br>Система налогообложения |
| vat\_id | integer<br>НДС |

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив с объектами данных |
| meta | Array of objects<br>Метаданные (пустой массив) |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения |
| data | string<br>Содержит null |
| meta | object<br>Содержит сообщение об ошибках |

### Request samples

- Payload

Content type

application/json

Copy

`{
"title": "Шампунь",
"print_title": "Шампунь",
"article": "123",
"barcode": "123",
"category_id": 289632,
"cost": 1000,
"actual_cost": 500,
"sale_unit_id": 216762,
"service_unit_id": 216762,
"unit_equals": 100,
"critical_amount": 1,
"desired_amount": 1,
"netto": 200,
"brutto": 250,
"comment": "Test comment 123",
"tax_variant": 0,
"vat_id": 3}`

### Response samples

- 201
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"title": "Шампунь 1",\
"value": "Шампунь 1",\
"label": "Шампунь 1 (123)",\
"good_id": "123456",\
"cost": "100500",\
"unit_id": "4835",\
"unit_short_title": "шт",\
"service_unit_id": "3548",\
"service_unit_short_title": "гр",\
"actual_cost": "1050",\
"unit_actual_cost": "105",\
"unit_actual_cost_format": "105 р",\
"unit_equals": "10",\
"barcode": "123",\
"loyalty_abonement_type_id": 0,\
"loyalty_certificate_type_id": 0,\
"loyalty_allow_empty_code": 1,\
"critical_amount": 0,\
"desired_amount": 0,\
"actual_amounts": [\
{\
"storage_id": "987",\
"amount": "1000000"}],\
"last_change_date": "2017-01-01T12:00:00+0400"}],
"meta": [ ]}`

## [tag/Tovary/operation/Получить товары](https://developers.yclients.com/ru/\#tag/Tovary/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%82%D0%BE%D0%B2%D0%B0%D1%80%D1%8B) Получить товары

get/goods/{company\_id}/{good\_id}

https://api.yclients.com/api/v1/goods/{company\_id}/{good\_id}

- term: Наименование, артикул или штрих-код

- page (number, `1`) \- Номер страницы (не используется, если передан good\_id)

- count (number, `25`) \- Количество товаров на странице (не используется, если передан good\_id)

- category\_id (number, `777`) \- Id категории товаров (не используется, если передан good\_id)

- changed\_after (string) - фильтрация товаров, измененных/созданных начиная с конкретной даты и времени (не используется, если передан good\_id)

- changed\_before (string) - фильтрация товаров, измененных/созданных до конкретной даты и времени (не используется, если передан good\_id)


##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| good\_id<br>required | number<br>ID товара (если нужно получить конкретный товар) |

##### query Parameters

|     |     |
| --- | --- |
| term | string<br>наименование, артикул или штрих-код |
| page | number<br>Example:page=1<br>номер страницы |
| count | number<br>Example:count=25<br>количество товаров на странице |
| category\_id | number<br>Id категории товаров |
| changed\_after | string<br>Example:changed\_after=2016-01-01T12:00:00+0400<br>фильтрация товаров, измененных/созданных начиная с конкретной даты и времени |
| changed\_before | string<br>Example:changed\_before=2017-01-01T12:00:00+0400<br>фильтрация товаров, измененных/созданных до конкретной даты и времени |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив с объектами данных |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"title": "Шампунь 1",\
"value": "Шампунь 1",\
"label": "Шампунь 1 (123)",\
"good_id": "123456",\
"cost": "100500",\
"unit_id": "4835",\
"unit_short_title": "шт",\
"service_unit_id": "3548",\
"service_unit_short_title": "гр",\
"actual_cost": "1050",\
"unit_actual_cost": "105",\
"unit_actual_cost_format": "105 р",\
"unit_equals": "10",\
"barcode": "123",\
"loyalty_abonement_type_id": 0,\
"loyalty_certificate_type_id": 0,\
"loyalty_allow_empty_code": 1,\
"critical_amount": 0,\
"desired_amount": 0,\
"actual_amounts": [\
{\
"storage_id": "987",\
"amount": "1000000"}],\
"last_change_date": "2017-01-01T12:00:00+0400"}],
"meta": [ ]}`

## [tag/Tovary/paths/~1goods~1{company_id}~1{good_id}/put](https://developers.yclients.com/ru/\#tag/Tovary/paths/~1goods~1{company_id}~1{good_id}/put) Редактировать товар

put/goods/{company\_id}/{good\_id}

https://api.yclients.com/api/v1/goods/{company\_id}/{good\_id}

Метод позволяет изменить параметры товара.
При редактировании единиц измерения у товара, по которому уже имеются складские операции, необходимо добавлять массив правил пересчета единиц измерения \- correction\_rules. В ином случае, массив является необязательным.

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Идентификатор филиала |
| good\_id<br>required | number<br>Идентификатор товара |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| title<br>required | string<br>Название товара |
| print\_title | string<br>Название для печати в чеке |
| article | string<br>Артикул |
| barcode | string<br>Штрих-код |
| category\_id<br>required | integer<br>Идентификатор категории товара |
| cost | number<float><br>Цена продажи |
| actual\_cost | number<float><br>Себестоимость |
| sale\_unit\_id<br>required | integer<br>Единица измерения для продажи |
| service\_unit\_id<br>required | integer<br>Единица измерения для списания |
| unit\_equals | number<float><br>Отношение ед.имзерения для продажи к ед.измерения для списания |
| critical\_amount | number<float><br>Критичный остаток |
| desired\_amount | number<float><br>Желаемый остаток |
| netto | number<float><br>Масса нетто |
| brutto | number<float><br>Масса брутто |
| comment | string<br>Комментарий |
| tax\_variant | integer<br>Система налогообложения |
| vat\_id | integer<br>НДС |
| correction\_rules | Array of objects<br>Массив правил пересчета единиц измерения (необходим, если по товару есть складские операциии) |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив с объектами данных |
| meta | Array of objects<br>Метаданные (пустой массив) |

**409**
Conflict

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения |
| data | string<br>Содержит null |
| meta | object<br>Объект с сообщением об ошибке |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения |
| data | string<br>Содержит null |
| meta | object<br>Содержит сообщение об ошибках |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"title": "Шампунь",
"print_title": "Шампунь",
"article": "123",
"barcode": "123",
"category_id": 289632,
"cost": 1000,
"actual_cost": 500,
"sale_unit_id": 216762,
"service_unit_id": 216762,
"unit_equals": 100,
"critical_amount": 1,
"desired_amount": 1,
"netto": 200,
"brutto": 250,
"comment": "Test comment 123",
"tax_variant": 0,
"vat_id": 3,
"correction_rules": [\
{\
"type": 1,\
"base_unit": "service"},\
{\
"type": 2,\
"base_unit": "service"},\
{\
"type": 3,\
"base_unit": "sale"},\
{\
"type": 4,\
"base_unit": "sale"},\
{\
"type": 5,\
"base_unit": "sale"}]}`

### Response samples

- 200
- 409
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"title": "Шампунь 1",\
"value": "Шампунь 1",\
"label": "Шампунь 1 (123)",\
"good_id": "123456",\
"cost": "100500",\
"unit_id": "4835",\
"unit_short_title": "шт",\
"service_unit_id": "3548",\
"service_unit_short_title": "гр",\
"actual_cost": "1050",\
"unit_actual_cost": "105",\
"unit_actual_cost_format": "105 р",\
"unit_equals": "10",\
"barcode": "123",\
"loyalty_abonement_type_id": 0,\
"loyalty_certificate_type_id": 0,\
"loyalty_allow_empty_code": 1,\
"critical_amount": 0,\
"desired_amount": 0,\
"actual_amounts": [\
{\
"storage_id": "987",\
"amount": "1000000"}],\
"last_change_date": "2017-01-01T12:00:00+0400"}],
"meta": [ ]}`

## [tag/Tovary/paths/~1goods~1{company_id}~1{good_id}/delete](https://developers.yclients.com/ru/\#tag/Tovary/paths/~1goods~1{company_id}~1{good_id}/delete) Удалить товар

delete/goods/{company\_id}/{good\_id}

https://api.yclients.com/api/v1/goods/{company\_id}/{good\_id}

Метод позволяет удалить товар

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Идентификатор филиала |
| good\_id<br>required | number<br>Идентификатор товара |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**204**
No Content

# [tag/Kategorii-tovarov](https://developers.yclients.com/ru/\#tag/Kategorii-tovarov) Категории товаров

Объект категории товаров имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | id категории |
| title | string | Название категории |
| parent\_category\_id | string | ID родительской категории |

## [tag/Kategorii-tovarov/paths/~1goods~1search~1{company_id}?term={search_term}&count={max_count}/get](https://developers.yclients.com/ru/\#tag/Kategorii-tovarov/paths/~1goods~1search~1{company_id}?term={search_term}&count={max_count}/get) Пример запроса на получение списка

get/goods/search/{company\_id}?term={search\_term}&count={max\_count}

https://api.yclients.com/api/v1/goods/search/{company\_id}?term={search\_term}&count={max\_count}

### Список товаров и товарных категорий

Список **товаров и товарных категорий** можно получить, сделав запрос с указанием идентификатора филиала.
Список можно отфильтровать по названию или артикулу категории товаров, по названию, артикулу или штрихкоду товара, передав параметр `search_term`.
Количество результатов ограничивается параметром `max_count`.

Если `search_term` не передан, выводится список корневых категорий филиала без учета `max_count`. Если `search_term` передан, сначала производится поиск по категориям, затем (если найдено меньше, чем `max_count`) \- по товарам

Список представляет собой массив [элементов дерева товаров](https://developers.yclients.com/ru/#good-category-tree-node).

**Элемент дерева товаров** имеет следующую структуру:

| Поле | Тип | Описание |
| --- | --- | --- |
| parent\_id | number | Идентификатор родительского элемента (0 для корневых элементов) |
| item\_id | number | Идентификатор товара (0, если элемент - категория) |
| category\_id | number | Идентификатор товарной категории (0, если элемент - товар) |
| title | string | Название товара или товарной категории |
| is\_chain | boolean | Является ли элемент привязанным к сети? true - элемент привязан к сети, false - не привязан |
| is\_category | boolean | Является ли элемент категорией? true - категория, false - товар |
| is\_item | boolean | Является ли элемент товаром? true - товар, false - категория |

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### query Parameters

|     |     |
| --- | --- |
| search\_term | string<br>Поисковый запрос по названию, артикулу или штрихкоду |
| max\_count | number<br>Количество выводимых строк на странице. Максимум 100 |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив с объектами данных |
| meta | object<br>Метаданные (содержит количество найденных категорий) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"parent_id": 0,\
"item_id": 0,\
"category_id": 123,\
"title": "Корневая категория 1",\
"is_chain": true,\
"is_category": true,\
"is_item": false},\
{\
"parent_id": 0,\
"item_id": 0,\
"category_id": 456,\
"title": "Корневая категория 2",\
"is_chain": true,\
"is_category": true,\
"is_item": false}],
"meta": {
"count": 2}}`

## [tag/Kategorii-tovarov/operation/Пример запроса на получение состава категории](https://developers.yclients.com/ru/\#tag/Kategorii-tovarov/operation/%D0%9F%D1%80%D0%B8%D0%BC%D0%B5%D1%80%20%D0%B7%D0%B0%D0%BF%D1%80%D0%BE%D1%81%D0%B0%20%D0%BD%D0%B0%20%D0%BF%D0%BE%D0%BB%D1%83%D1%87%D0%B5%D0%BD%D0%B8%D0%B5%20%D1%81%D0%BE%D1%81%D1%82%D0%B0%D0%B2%D0%B0%20%D0%BA%D0%B0%D1%82%D0%B5%D0%B3%D0%BE%D1%80%D0%B8%D0%B8) Пример запроса на получение состава категории

get/goods/category\_node/{company\_id}/{category\_id}?page={page}&count={count}

https://api.yclients.com/api/v1/goods/category\_node/{company\_id}/{category\_id}?page={page}&count={count}

##№ Состав товарной категории

Информацию по товарной категории и ее потомкам можно получить, сделав запрос с указанием идентификатора филиала и товарной категории.
Поддерживается постраничный вывод, задаваемый параметрами `page` и `count`.

**Состав товарной категории** имеет следующую структуру:

| Поле | Тип | Описание |
| --- | --- | --- |
| parent\_id | number | Идентификатор родительского элемента (0 для корневых элементов) |
| item\_id | number | Идентификатор товара (всегда 0) |
| category\_id | number | Идентификатор товарной категории |
| title | string | Название товарной категории |
| is\_chain | boolean | Является ли элемент привязанным к сети? true - элемент привязан к сети, false - не привязан |
| is\_category | boolean | Является ли элемент категорией? всегда true |
| is\_item | boolean | Является ли элемент товаром? всегда false |
| children | Array of objects( [Элемент дерева товаров](https://developers.yclients.com/ru/#good-category-tree-node)) | Дочерние элементы товарной категории |
| children\_count | number | Полное число дочерних товаров и категорий (без рекурсии) |

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| category\_id<br>required | number<br>ID товарной категории |

##### query Parameters

|     |     |
| --- | --- |
| page | number<br>Номер страницы |
| count | number<br>Количество выводимых товаров на странице. Максимум 1000 |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object<br>Объект с данными |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"parent_id": 0,
"item_id": 0,
"category_id": 123,
"title": "Корневая категория 1",
"is_chain": false,
"is_category": true,
"is_item": false,
"children": [\
{\
"parent_id": 123,\
"item_id": 0,\
"category_id": 456,\
"title": "Дочерняя категория",\
"is_chain": false,\
"is_category": true,\
"is_item": false},\
{\
"parent_id": 123,\
"item_id": 789,\
"category_id": 0,\
"title": "Дочерний товар",\
"is_chain": false,\
"is_category": false,\
"is_item": true}],
"children_count": 2}}`

## [tag/Kategorii-tovarov/operation/Получить список категорий товаров](https://developers.yclients.com/ru/\#tag/Kategorii-tovarov/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%BE%D0%BA%20%D0%BA%D0%B0%D1%82%D0%B5%D0%B3%D0%BE%D1%80%D0%B8%D0%B9%20%D1%82%D0%BE%D0%B2%D0%B0%D1%80%D0%BE%D0%B2) Получить список категорий товаров Deprecated

get/goods\_categories/{company\_id}/{parent\_category\_id}

https://api.yclients.com/api/v1/goods\_categories/{company\_id}/{parent\_category\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| parent\_category\_id<br>required | number<br>ID родительской категории товара. По умолчанию 0 - выводятся категории верхнего уровня (необязательный) |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": "1",\
"title": "Категория 1"},\
{\
"id": "2",\
"title": "Категория 2"}],
"meta": [ ]}`

## [tag/Kategorii-tovarov/paths/~1goods_categories~1multiple~1{company_id}/get](https://developers.yclients.com/ru/\#tag/Kategorii-tovarov/paths/~1goods_categories~1multiple~1{company_id}/get) Получить список категорий товаров по идентификатору

get/goods\_categories/multiple/{company\_id}

https://api.yclients.com/api/v1/goods\_categories/multiple/{company\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### query Parameters

|     |     |
| --- | --- |
| id | number<br>ID товарной категории (можно указать несколько дополнительными параметрами &ids\[\]={id} |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": "1",\
"title": "Категория 1"},\
{\
"id": "2",\
"title": "Категория 2"}],
"meta": [ ]}`

## [tag/Kategorii-tovarov/operation/Пример запроса на получение категорий](https://developers.yclients.com/ru/\#tag/Kategorii-tovarov/operation/%D0%9F%D1%80%D0%B8%D0%BC%D0%B5%D1%80%20%D0%B7%D0%B0%D0%BF%D1%80%D0%BE%D1%81%D0%B0%20%D0%BD%D0%B0%20%D0%BF%D0%BE%D0%BB%D1%83%D1%87%D0%B5%D0%BD%D0%B8%D0%B5%20%D0%BA%D0%B0%D1%82%D0%B5%D0%B3%D0%BE%D1%80%D0%B8%D0%B9) Пример запроса на получение категорий

get/company/{company\_id}/goods\_categories/{parent\_category\_id}

https://api.yclients.com/api/v1/company/{company\_id}/goods\_categories/{parent\_category\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| parent\_category\_id<br>required | number<br>ID родительской товарной категории |

##### query Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 25214,\
"title": "Doughter 1",\
"parent_category_id": 24843},\
{\
"id": 25213,\
"title": "Root 1"},\
{\
"id": 25219,\
"title": "Root 2"}],
"meta": {
"count": 94}}`

## [tag/Kategorii-tovarov/paths/~1goods_categories~1{company_id}/post](https://developers.yclients.com/ru/\#tag/Kategorii-tovarov/paths/~1goods_categories~1{company_id}/post) Создать категорию товаров

post/goods\_categories/{company\_id}

https://api.yclients.com/api/v1/goods\_categories/{company\_id}

Метод позволяет создать категорию товаров.

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Идентификатор филиала |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| title<br>required | string<br>Название категории товаров |
| parent\_category\_id | integer<int32><br>Инедтификатор родительской категории (параметр необязательный, но может принимать значение 0 или null, в случае, когда не нужно указывать родительскую категорию) |
| article | string<br>Артикул |
| comment | string<br>Комментарий |

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Request samples

- Payload

Content type

application/json

Copy

`{
"title": "Маникюр",
"parent_category_id": 123456,
"article": "123article",
"comment": "Категория товаров для маникюра"}`

### Response samples

- 201

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 123456,
"title": "Маникюр",
"parent_category_id": 123457},
"meta": [ ]}`

## [tag/Kategorii-tovarov/paths/~1goods_categories~1{company_id}~1{category_id}/put](https://developers.yclients.com/ru/\#tag/Kategorii-tovarov/paths/~1goods_categories~1{company_id}~1{category_id}/put) Редактировать категорию товаров

put/goods\_categories/{company\_id}/{category\_id}

https://api.yclients.com/api/v1/goods\_categories/{company\_id}/{category\_id}

Метод позволяет отредактировать категорию товаров

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Идентификатор филиала |
| category\_id<br>required | number<br>Идентификатор категории товаров |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| title<br>required | string<br>Название категории товаров |
| parent\_category\_id | integer<int32><br>Инедтификатор родительской категории (параметр необязательный, но может принимать значение 0 или null, в случае, когда не нужно указывать родительскую категорию) |
| article | string<br>Артикул |
| comment | string<br>Комментарий |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Request samples

- Payload

Content type

application/json

Copy

`{
"title": "Маникюр",
"parent_category_id": 123456,
"article": "123article",
"comment": "Категория товаров для маникюра"}`

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 123456,
"title": "Маникюр",
"parent_category_id": 123457},
"meta": [ ]}`

## [tag/Kategorii-tovarov/paths/~1goods_categories~1{company_id}~1{category_id}/delete](https://developers.yclients.com/ru/\#tag/Kategorii-tovarov/paths/~1goods_categories~1{company_id}~1{category_id}/delete) Удалить категорию товаров

delete/goods\_categories/{company\_id}/{category\_id}

https://api.yclients.com/api/v1/goods\_categories/{company\_id}/{category\_id}

Метод позволяет удалить категорию товаров

##### Authorizations:

(_user__bearer_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Идентификатор филиала |
| category\_id<br>required | number<br>Идентификатор категории товаров |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**204**
No Content

# [tag/Tehnologicheskie-karty-i-rashodniki](https://developers.yclients.com/ru/\#tag/Tehnologicheskie-karty-i-rashodniki) Технологические карты и расходники

Объект технологической карты имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | id тех карты |
| title | string | Название тех карты |
| technological\_card\_items | array | Список расходников тех карты |

## [tag/Tehnologicheskie-karty-i-rashodniki/operation/Получить список тех карт](https://developers.yclients.com/ru/\#tag/Tehnologicheskie-karty-i-rashodniki/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%BE%D0%BA%20%D1%82%D0%B5%D1%85%20%D0%BA%D0%B0%D1%80%D1%82) Получить список тех карт

get/technological\_cards/{company\_id}/

https://api.yclients.com/api/v1/technological\_cards/{company\_id}/

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID филиала |

##### query Parameters

|     |     |
| --- | --- |
| search | string<br>Example:search='test'<br>параметр для поиска по названию тех карты |
| page | number<br>Example:page=1<br>номер страницы |
| count | number<br>Example:count=20<br>количество тех карт на странице |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объеков с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": "1",\
"title": "Тех карта 1",\
"technological_card_items": [\
{\
"id": 3,\
"technological_card_id": 1,\
"storage_id": 4234,\
"good_id": 34234,\
"amount": 12,\
"unit": "л",\
"price": 0.0742,\
"title": "Расходник 3"}]},\
{\
"id": "2",\
"title": "Тех карта 2",\
"technological_card_items": [\
{\
"id": 4,\
"technological_card_id": 2,\
"storage_id": 4234,\
"good_id": 34235,\
"amount": 10,\
"unit": "л",\
"price": 0.02412,\
"title": "Расходник 4"}]}],
"meta": [ ]}`

## [tag/Tehnologicheskie-karty-i-rashodniki/operation/Получить тех карту для связи сотрудник услуга](https://developers.yclients.com/ru/\#tag/Tehnologicheskie-karty-i-rashodniki/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%82%D0%B5%D1%85%20%D0%BA%D0%B0%D1%80%D1%82%D1%83%20%D0%B4%D0%BB%D1%8F%20%D1%81%D0%B2%D1%8F%D0%B7%D0%B8%20%D1%81%D0%BE%D1%82%D1%80%D1%83%D0%B4%D0%BD%D0%B8%D0%BA%20%D1%83%D1%81%D0%BB%D1%83%D0%B3%D0%B0) Получить тех карту для связи сотрудник услуга

get/technological\_cards/default\_for\_staff\_and\_service/{company\_id}/{staffId}/{serviceId}/

https://api.yclients.com/api/v1/technological\_cards/default\_for\_staff\_and\_service/{company\_id}/{staffId}/{serviceId}/

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID филиала |
| staffId<br>required | number<br>ID сотрудника |
| serviceId<br>required | number<br>ID услуги |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объеков с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": "1",
"title": "Тех карта 1",
"technological_card_items": [\
{\
"id": 3,\
"technological_card_id": 1,\
"storage_id": 4234,\
"good_id": 34234,\
"amount": 12,\
"unit": "л",\
"price": 0.0742,\
"title": "Расходник 3"}]},
"meta": [ ]}`

## [tag/Tehnologicheskie-karty-i-rashodniki/operation/Получить список тех карт и расходников записи](https://developers.yclients.com/ru/\#tag/Tehnologicheskie-karty-i-rashodniki/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%BE%D0%BA%20%D1%82%D0%B5%D1%85%20%D0%BA%D0%B0%D1%80%D1%82%20%D0%B8%20%D1%80%D0%B0%D1%81%D1%85%D0%BE%D0%B4%D0%BD%D0%B8%D0%BA%D0%BE%D0%B2%20%D0%B7%D0%B0%D0%BF%D0%B8%D1%81%D0%B8) Получить список тех карт и расходников записи

get/technological\_cards/record\_consumables/{company\_id}/{record\_id}/

https://api.yclients.com/api/v1/technological\_cards/record\_consumables/{company\_id}/{record\_id}/

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID филиала |
| record\_id<br>required | number<br>ID записи |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"service_id": 21558,\
"record_id": 1233243,\
"technological_cards": [\
{\
"id": 36069,\
"title": "Тех карта",\
"technological_card_items": [\
{\
"id": 208568,\
"technological_card_id": 36069,\
"storage_id": 91303,\
"good_id": 6858783,\
"amount": 10,\
"price": 1000,\
"good": {\
"id": 6858783,\
"title": "Товар",\
"unit": "г"}}]}],\
"consumables": [\
{\
"goods_transaction_id": 2180771,\
"record_id": 121793129,\
"service_id": 695486,\
"storage_id": 91303,\
"good_id": 6858783,\
"price": 1000,\
"amount": 10,\
"good": {\
"id": 6858783,\
"title": "Товар",\
"unit": "г"}}]}],
"meta": [ ]}`

## [tag/Tehnologicheskie-karty-i-rashodniki/operation/Удалить технологическую из связи запись-услуга](https://developers.yclients.com/ru/\#tag/Tehnologicheskie-karty-i-rashodniki/operation/%D0%A3%D0%B4%D0%B0%D0%BB%D0%B8%D1%82%D1%8C%20%D1%82%D0%B5%D1%85%D0%BD%D0%BE%D0%BB%D0%BE%D0%B3%D0%B8%D1%87%D0%B5%D1%81%D0%BA%D1%83%D1%8E%20%D0%B8%D0%B7%20%D1%81%D0%B2%D1%8F%D0%B7%D0%B8%20%D0%B7%D0%B0%D0%BF%D0%B8%D1%81%D1%8C-%D1%83%D1%81%D0%BB%D1%83%D0%B3%D0%B0) Удалить технологическую из связи запись-услуга

delete/technological\_cards/record\_consumables/technological\_cards/{company\_id}/{record\_id}/{service\_id}

https://api.yclients.com/api/v1/technological\_cards/record\_consumables/technological\_cards/{company\_id}/{record\_id}/{service\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID филиала |
| record\_id<br>required | number<br>ID записи |
| service\_id<br>required | number<br>ID услуги |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: \*/\*

|     |     |
| --- | --- |
| delete\_consumables | number<br>удалить ли расходники вместе с удалением тех карты. По умолчанию 0 |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив с объектом |
| meta | object<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"service_id": 7224099,\
"record_id": 310013764,\
"technological_cards": [ ],\
"consumables": [ ]}],
"meta": {
"count": 1}}`

## [tag/Tehnologicheskie-karty-i-rashodniki/operation/Изменить список расходников связи запись-услуга](https://developers.yclients.com/ru/\#tag/Tehnologicheskie-karty-i-rashodniki/operation/%D0%98%D0%B7%D0%BC%D0%B5%D0%BD%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%BE%D0%BA%20%D1%80%D0%B0%D1%81%D1%85%D0%BE%D0%B4%D0%BD%D0%B8%D0%BA%D0%BE%D0%B2%20%D1%81%D0%B2%D1%8F%D0%B7%D0%B8%20%D0%B7%D0%B0%D0%BF%D0%B8%D1%81%D1%8C-%D1%83%D1%81%D0%BB%D1%83%D0%B3%D0%B0) Изменить список расходников связи запись-услуга

put/technological\_cards/record\_consumables/consumables/{company\_id}/{record\_id}/{service\_id}/

https://api.yclients.com/api/v1/technological\_cards/record\_consumables/consumables/{company\_id}/{record\_id}/{service\_id}/

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID филиала |
| record\_id<br>required | number<br>ID записи |
| service\_id<br>required | number<br>ID услуги |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| consumables | Array of objects<br>Список расходников |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"consumables": [\
{\
"goods_transaction_id": 0,\
"record_id": 0,\
"service_id": 0,\
"storage_id": 0,\
"good_id": 0,\
"price": 0,\
"amount": 0}]}`

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"service_id": 21558,\
"record_id": 1233243,\
"technological_cards": [\
{\
"id": 36069,\
"title": "Тех карта",\
"technological_card_items": [\
{\
"id": 208568,\
"technological_card_id": 36069,\
"storage_id": 91303,\
"good_id": 6858783,\
"amount": 10,\
"price": 1000,\
"good": {\
"id": 6858783,\
"title": "Товар",\
"unit": "г"}}]}],\
"consumables": [\
{\
"goods_transaction_id": 2180771,\
"record_id": 121793129,\
"service_id": 695486,\
"storage_id": 91303,\
"good_id": 6858783,\
"price": 1000,\
"amount": 10,\
"good": {\
"id": 6858783,\
"title": "Товар",\
"unit": "г"}}]}],
"meta": [ ]}`

# [tag/Tovarnye-tranzakcii](https://developers.yclients.com/ru/\#tag/Tovarnye-tranzakcii) Товарные транзакции

Объект товарной транзакции имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | ID транзакции |
| document\_id | number | ID документа |
| type\_id | number | ID типа транзакции |
| type | string | Тип транзакции |
| good | good | Товар |
| storage | storage | Склад |
| unit | unit | Единица измерения |
| operation\_unit\_type | number | Тип единицы измерения: 1 - для продажи, 2 - для списания |
| create\_date | string | Дата создания |
| last\_change\_date | string | Дата последнего изменения |
| cost\_per\_unit | float | Цена за единицу |
| cost | float | Цена |
| discount | float | Скидка |
| master | master | Сотрудник |
| supplier | supplier | Поставщик |
| service | service | Услуга |
| client | client | Клиент |

Объект good имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | ID товара |
| title | string | Наименование |
| unit | string | Единица измерения |
| value | string | Название товара |
| label | string | Название товара |
| article | string | Артикул |
| category | string | Название категории товара |
| category\_id | number | Идентификатор категории товара |
| salon\_id | number | Идентификатор компании |
| good\_id | number | Идентификатор товара |
| cost | float | Стоимость |
| unit\_id | number | Идентификатор единицы измерения |
| unit\_short\_title | string | Сокращенное название единицы измерения |
| service\_unit\_id | number | Идентификатор единицы измерения для услуги |
| service\_unit\_short\_title | string | Сокращенное название единицы измерения для услуги |
| actual\_cost | float | Себестоимость |
| unit\_actual\_cost | float | Себестоимость за единицу |
| unit\_actual\_cost\_format | string | Формат себестоимости за единицу |
| unit\_equals | number | Значение единицы измерения |
| barcode | string | Штрих-код |
| loyalty\_abonement\_type\_id | number | Идентификатор абонемента (если товар это абонемент) |
| loyalty\_certificate\_type\_id | number | Идентификатор сертификата (если товар это сертификат) |
| good\_special\_number | string | Код абонемента\\сертификата |
| loyalty\_allow\_empty\_code | number | Разрешена ли продажа без кода |
| actual\_amounts | array | Количество товара |
| last\_change\_date | string | Дата последнего изменения товара |

Объект storage имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | ID склада |
| title | string | Наименование |

Объект unit имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | ID склада |
| title | string | Единица измерения |

Объект master имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | ID сотрудника |
| title | string | Имя сотрудника |

Объект supplier имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | ID поставщика |
| title | string | Имя поставщика |

Объект service имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | ID услуги |
| title | string | Название услуги |

Объект client имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | ID клиента |
| name | string | Имя клиента |
| phone | string | Телефон клиента |

## [tag/Tovarnye-tranzakcii/operation/Поиск товарных транзакций](https://developers.yclients.com/ru/\#tag/Tovarnye-tranzakcii/operation/%D0%9F%D0%BE%D0%B8%D1%81%D0%BA%20%D1%82%D0%BE%D0%B2%D0%B0%D1%80%D0%BD%D1%8B%D1%85%20%D1%82%D1%80%D0%B0%D0%BD%D0%B7%D0%B0%D0%BA%D1%86%D0%B8%D0%B9) Поиск товарных транзакций

get/storages/transactions/{company\_id}

https://api.yclients.com/api/v1/storages/transactions/{company\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### query Parameters

|     |     |
| --- | --- |
| page | number<br>Example:page=1<br>номер страницы |
| count | number<br>Example:count=20<br>количество транзакций на странице |
| start\_date | date<br>Example:start\_date=2020-01-01<br>дата начала периода |
| end\_date | date<br>Example:end\_date=2020-02-01<br>дата окончания периода |
| document\_id | string<br>ID документа |
| changed\_after | ISO 8601<br>Example:changed\_after=2020-01-01T00:00:00<br>Фильтрация товарных транзакций, измененных/созданных начиная с конкретной даты и времени |
| changed\_before | ISO 8601<br>Example:changed\_before=2020-03-01T23:59:59<br>Фильтрация товарных транзакций, измененных/созданных до конкретной даты и времени |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 123456789,\
"document_id": 22256643,\
"type_id": 987654321,\
"type": "Нечто",\
"operation_unit_type": 1,\
"amount": -0.25,\
"comment": "",\
"good": {\
"id": 111222333,\
"title": "Something"},\
"storage": {\
"id": 333222111,\
"title": "Storage 1"},\
"unit": {\
"id": "333222111",\
"title": "миллилитр"},\
"create_date": "2012-12-21T19:08:00+0400",\
"last_change_date": "2020-02-01T12:00:00+0400",\
"cost_per_unit": "1.07",\
"cost": "0.00",\
"discount": "10.00",\
"master": {\
"id": "112233445",\
"title": "Василий Иванов"},\
"supplier": {\
"id": "11112222",\
"title": "Best Supplier Ever"},\
"record_id": 0,\
"loyalty_abonement_id": 0,\
"loyalty_certificate_id": 0,\
"service": {\
"id": "1234321",\
"title": "Услуга 4"},\
"client": {\
"id": "4321234",\
"name": "Джордж Смит",\
"phone": 79876543210}}],
"meta": [ ]}`

## [tag/Tovarnye-tranzakcii/operation/Создать транзакцию](https://developers.yclients.com/ru/\#tag/Tovarnye-tranzakcii/operation/%D0%A1%D0%BE%D0%B7%D0%B4%D0%B0%D1%82%D1%8C%20%D1%82%D1%80%D0%B0%D0%BD%D0%B7%D0%B0%D0%BA%D1%86%D0%B8%D1%8E) Создать транзакцию

post/storage\_operations/goods\_transactions/{company\_id}

https://api.yclients.com/api/v1/storage\_operations/goods\_transactions/{company\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| document\_id<br>required | number<float><br>Идентификатор документа |
| good\_id<br>required | number<br>Идентификатор товара |
| amount<br>required | number<br>Количество |
| cost\_per\_unit<br>required | number<float><br>Стоимость за единицу товара |
| discount<br>required | number<br>Скидка в % |
| cost<br>required | number<float><br>Итоговая сумма транзакции |
| operation\_unit\_type<br>required | number<br>тип единицы измерения: 1 - для продажи, 2 - для списания |
| good\_special\_number | string<br>Код абонемента\\сертификата, если товар является абонементом или сертификатом |
| master\_id | number<br>Идентификатор мастера, продавшего товар |
| client\_id | number<br>Идентификатор клиента, купившего товар |
| supplier\_id | number<br>Идентификатор поставщика |
| comment | string<br>Комментарий |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Request samples

- Payload

Content type

application/json

Copy

`{
"document_id": 22254960,
"good_id": 232674,
"amount": 1,
"cost_per_unit": 100,
"discount": 10,
"cost": 90,
"operation_unit_type": 1,
"master_id": 26781,
"client_id": 0,
"supplier_id": 0,
"comment": "Transaction comment"}`

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 3428010,
"document_id": 22254960,
"type_id": 1,
"type": {
"id": 1,
"title": "Продажа товара"},
"company_id": 4564,
"good_id": 232674,
"amount": -1,
"service_amount": 100,
"sale_amount": 1,
"cost_per_unit": 100,
"discount": 10,
"cost": 90,
"unit_id": 1,
"service_unit_id": 216761,
"sale_unit_id": 216760,
"operation_unit_type": 1,
"storage_id": 36539,
"supplier_id": 0,
"client_id": 0,
"master_id": 26781,
"create_date": 1493157001,
"last_change_date": "2020-02-01T12:00:00+0400",
"comment": "Transaction comment",
"deleted": false,
"good": {
"id": 232674,
"title": "Edition De Luxe"},
"storage": {
"id": 36539,
"title": "Товары"},
"supplier": [ ],
"client": [ ],
"master": {
"id": "26781",
"name": "Анджелина Джоли"},
"unit": {
"id": 1,
"title": "Штука"}},
"meta": [ ]}`

## [tag/Tovarnye-tranzakcii/operation/Получение транзакции](https://developers.yclients.com/ru/\#tag/Tovarnye-tranzakcii/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B5%D0%BD%D0%B8%D0%B5%20%D1%82%D1%80%D0%B0%D0%BD%D0%B7%D0%B0%D0%BA%D1%86%D0%B8%D0%B8) Получение транзакции

get/storage\_operations/goods\_transactions/{company\_id}/{transaction\_id}

https://api.yclients.com/api/v1/storage\_operations/goods\_transactions/{company\_id}/{transaction\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| transaction\_id<br>required | number<br>ID транзакции |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 3428010,
"document_id": 22254960,
"type_id": 1,
"type": {
"id": 1,
"title": "Продажа товара"},
"company_id": 4564,
"good_id": 232674,
"amount": -1,
"cost_per_unit": 100,
"discount": 10,
"cost": 90,
"unit_id": 1,
"storage_id": 36539,
"supplier_id": 0,
"client_id": 0,
"master_id": 26781,
"create_date": 1493157001,
"comment": "Transaction comment",
"deleted": false,
"good": {
"id": 232674,
"title": "Edition De Luxe",
"unit": "шт.",
"value": "удалить гг",
"label": "удалить гг",
"article": "",
"category": "Гусиная категория",
"category_id": 303603,
"salon_id": 91372,
"good_id": 15086312,
"cost": 500,
"unit_id": 216760,
"unit_short_title": "шт",
"service_unit_id": 216760,
"service_unit_short_title": "шт",
"actual_cost": 0,
"unit_actual_cost": 0,
"unit_actual_cost_format": "0 ₽",
"unit_equals": 1,
"barcode": "",
"loyalty_abonement_type_id": 0,
"loyalty_certificate_type_id": 0,
"loyalty_allow_empty_code": 1,
"actual_amounts": [ ],
"last_change_date": "2021-03-05T18:21:34+0400"},
"storage": {
"id": 36539,
"title": "Товары"},
"sale_unit": null,
"service_unit": null,
"supplier": [ ],
"client": [ ],
"master": {
"id": "26781",
"name": "Анджелина Джоли"},
"unit": {
"id": 1,
"title": "Штука",
"short_title": "шт."}},
"meta": [ ]}`

## [tag/Tovarnye-tranzakcii/operation/Обновление транзакции](https://developers.yclients.com/ru/\#tag/Tovarnye-tranzakcii/operation/%D0%9E%D0%B1%D0%BD%D0%BE%D0%B2%D0%BB%D0%B5%D0%BD%D0%B8%D0%B5%20%D1%82%D1%80%D0%B0%D0%BD%D0%B7%D0%B0%D0%BA%D1%86%D0%B8%D0%B8) Обновление транзакции

put/storage\_operations/goods\_transactions/{company\_id}/{transaction\_id}

https://api.yclients.com/api/v1/storage\_operations/goods\_transactions/{company\_id}/{transaction\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| transaction\_id<br>required | number<br>ID транзакции |
| company\_id<br>required | number<br>ID компании |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: \*/\*

|     |     |
| --- | --- |
| document\_id<br>required | number<float><br>Идентификатор документа |
| good\_id<br>required | number<br>Идентификатор товара |
| amount<br>required | number<br>Количество |
| cost\_per\_unit<br>required | number<float><br>Стоимость за единицу товара |
| discount<br>required | number<br>Скидка в % |
| cost<br>required | number<float><br>Итоговая сумма транзакции |
| operation\_unit\_type<br>required | number<br>тип единицы измерения: 1 - для продажи, 2 - для списания |
| good\_special\_number | string<br>Код абонемента\\сертификата, если товар является абонементом или сертификатом |
| master\_id | number<br>Идентификатор мастера, продавшего товар |
| client\_id | number<br>Идентификатор клиента, купившего товар |
| supplier\_id | number<br>Идентификатор поставщика |
| comment | string<br>Комментарий |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 3428010,
"document_id": 22254960,
"type_id": 1,
"type": {
"id": 1,
"title": "Продажа товара"},
"company_id": 4564,
"good_id": 232674,
"amount": -1,
"cost_per_unit": 100,
"discount": 10,
"cost": 90,
"unit_id": 1,
"operation_unit_type": 1,
"storage_id": 36539,
"supplier_id": 0,
"client_id": 0,
"master_id": 26781,
"create_date": 1493157001,
"last_change_date": "2020-02-01T12:00:00+0400",
"comment": "Updated transaction comment",
"deleted": false,
"good": {
"id": 232674,
"title": "Edition De Luxe"},
"storage": {
"id": 36539,
"title": "Товары"},
"supplier": [ ],
"client": [ ],
"master": {
"id": "26781",
"name": "Анджелина Джоли"},
"unit": {
"id": 1,
"title": "Штука"}},
"meta": [ ]}`

## [tag/Tovarnye-tranzakcii/operation/Удаление транзакции](https://developers.yclients.com/ru/\#tag/Tovarnye-tranzakcii/operation/%D0%A3%D0%B4%D0%B0%D0%BB%D0%B5%D0%BD%D0%B8%D0%B5%20%D1%82%D1%80%D0%B0%D0%BD%D0%B7%D0%B0%D0%BA%D1%86%D0%B8%D0%B8) Удаление транзакции

delete/storage\_operations/goods\_transactions/{company\_id}/{transaction\_id}

https://api.yclients.com/api/v1/storage\_operations/goods\_transactions/{company\_id}/{transaction\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| transaction\_id<br>required | number<br>ID транзакции |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**202**
Accepted

# [tag/Skladskie-operacii](https://developers.yclients.com/ru/\#tag/Skladskie-operacii) Складские операции

## [tag/Skladskie-operacii/operation/Создание складской операции](https://developers.yclients.com/ru/\#tag/Skladskie-operacii/operation/%D0%A1%D0%BE%D0%B7%D0%B4%D0%B0%D0%BD%D0%B8%D0%B5%20%D1%81%D0%BA%D0%BB%D0%B0%D0%B4%D1%81%D0%BA%D0%BE%D0%B9%20%D0%BE%D0%BF%D0%B5%D1%80%D0%B0%D1%86%D0%B8%D0%B8) Создание складской операции

post/storage\_operations/operation/{company\_id}

https://api.yclients.com/api/v1/storage\_operations/operation/{company\_id}

Создание складской операции предполагает создание документа и нескольких товарных транзакций в рамках одного запроса к API.

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: \*/\*

|     |     |
| --- | --- |
| type\_id<br>required | number<br>Тип документа (1 продажа, 3 приход, 4 списание, 5 перемещение) |
| comment | string<br>Комментарий |
| create\_date<br>required | string<date-time><br>Дата создания документа |
| master\_id | number<br>Идентификатор мастера |
| storage\_id<br>required | number<br>Идентификатор склада |
| goods\_transactions<br>required | Array of objects<br>Массив объектов содержащих параметры транзакций, аналогично запросу на создание товарной транзакции |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"document": {
"id": 22255506,
"type_id": 1,
"type": {
"id": 1,
"title": "Продажа товара"},
"storage_id": 91271,
"user_id": 999290,
"company_id": 4564,
"number": 1254,
"comment": "test document comment",
"create_date": 1493128800,
"storage": {
"id": 91271,
"title": "Секретное место"},
"company": {
"id": 4564,
"title": "Бизнес образец",
"country_id": 1,
"city_id": 2,
"timezone": 3,
"address": "",
"coordinate_lat": "25.247901",
"coordinate_lon": "55.275397399999974",
"logo": "https://yclients.com/uploads/s_120d9410f1472a4e6bdbafefe7eeba42.png",
"zip": "",
"phones": [ ],
"site": ""},
"user": {
"id": "999290",
"name": "User name",
"phone": "70000000001"}},
"goods_transactions": [\
{\
"id": 3428012,\
"document_id": 22255506,\
"type_id": 1,\
"type": {\
"id": 1,\
"title": "Продажа товара"},\
"company_id": 4564,\
"good_id": 232674,\
"amount": -1,\
"cost_per_unit": 100,\
"discount": 10,\
"cost": 90,\
"unit_id": 1,\
"storage_id": 91271,\
"supplier_id": 0,\
"client_id": 0,\
"master_id": 0,\
"create_date": "2020-01-01 14:06:44",\
"comment": "test transaction comment",\
"deleted": false,\
"good": {\
"id": 232674,\
"title": "Edition De Luxe"},\
"storage": {\
"id": 91271,\
"title": "Секретное место"},\
"supplier": [ ],\
"client": [ ],\
"master": [ ],\
"unit": {\
"id": 1,\
"title": "Штука"}}]},
"meta": [ ]}`

# [tag/Dokumenty-skladskih-operacij](https://developers.yclients.com/ru/\#tag/Dokumenty-skladskih-operacij) Документы складских операций

Документ операции является обьединяющей сущностью для товарных и финансовых транзакций

## [tag/Dokumenty-skladskih-operacij/operation/Создать документ](https://developers.yclients.com/ru/\#tag/Dokumenty-skladskih-operacij/operation/%D0%A1%D0%BE%D0%B7%D0%B4%D0%B0%D1%82%D1%8C%20%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82) Создать документ

post/storage\_operations/documents/{company\_id}

https://api.yclients.com/api/v1/storage\_operations/documents/{company\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| type\_id<br>required | number<br>Тип документа (1 продажа, 3 приход, 4 списание) |
| comment | string<br>Комментарий |
| storage\_id<br>required | number<br>Идентификатор склада |
| create\_date<br>required | string<date-time><br>Дата проведения складской операции |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Request samples

- Payload

Content type

application/json

Copy

`{
"type_id": 1,
"comment": "Комментарий документа",
"storage_id": 36539,
"create_date": "2017-04-24 20:00:00"}`

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 22255503,
"type_id": 1,
"type": {
"id": 1,
"title": "Продажа товара"},
"storage_id": 36539,
"user_id": 999290,
"company_id": 4564,
"number": 1251,
"comment": "Document comment",
"create_date": "2017-04-24 20:00:00",
"storage": {
"id": 36539,
"title": "Товары"},
"company": {
"id": 4564,
"title": "Бизнес образец",
"country_id": 1,
"city_id": 2,
"timezone": 3,
"address": "",
"coordinate_lat": "25.247901",
"coordinate_lon": "55.275397399999974",
"logo": "https://yclients.com/uploads/s_120d9410f1472a4e6bdbafefe7eeba42.png",
"zip": "",
"phones": [ ],
"site": ""},
"user": {
"id": "999290",
"name": "User name",
"phone": "70000000001"}},
"meta": [ ]}`

## [tag/Dokumenty-skladskih-operacij/operation/Получить документ](https://developers.yclients.com/ru/\#tag/Dokumenty-skladskih-operacij/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82) Получить документ

get/storage\_operations/documents/{company\_id}/{document\_id}

https://api.yclients.com/api/v1/storage\_operations/documents/{company\_id}/{document\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| document\_id<br>required | number<br>ID документа |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 22255503,
"type_id": 1,
"type": {
"id": 1,
"title": "Продажа товара"},
"storage_id": 36539,
"user_id": 999290,
"company_id": 4564,
"number": 1251,
"comment": "Document comment",
"create_date": "2017-04-24 20:00:00",
"storage": {
"id": 36539,
"title": "Товары"},
"company": {
"id": 4564,
"title": "Бизнес образец",
"country_id": 1,
"city_id": 2,
"timezone": 3,
"address": "",
"coordinate_lat": "25.247901",
"coordinate_lon": "55.275397399999974",
"logo": "https://yclients.com/uploads/s_120d9410f1472a4e6bdbafefe7eeba42.png",
"zip": "",
"phones": [ ],
"site": ""},
"user": {
"id": "999290",
"name": "User name",
"phone": "70000000001"}},
"meta": [ ]}`

## [tag/Dokumenty-skladskih-operacij/operation/Обновить документ](https://developers.yclients.com/ru/\#tag/Dokumenty-skladskih-operacij/operation/%D0%9E%D0%B1%D0%BD%D0%BE%D0%B2%D0%B8%D1%82%D1%8C%20%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82) Обновить документ

put/storage\_operations/documents/{company\_id}/{document\_id}

https://api.yclients.com/api/v1/storage\_operations/documents/{company\_id}/{document\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| document\_id<br>required | number<br>ID документа |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: \*/\*

|     |     |
| --- | --- |
| type\_id<br>required | number<br>Тип документа (1 продажа, 3 приход, 4 списание) |
| comment | string<br>Комментарий |
| storage\_id<br>required | number<br>Идентификатор склада |
| create\_date<br>required | string<date-time><br>Дата проведения складской операции |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 22255503,
"type_id": 1,
"type": {
"id": 1,
"title": "Продажа товара"},
"storage_id": 36539,
"user_id": 999290,
"company_id": 4564,
"number": 1251,
"comment": "Updated document comment",
"create_date": "2017-04-24 20:00:00",
"storage": {
"id": 36539,
"title": "Товары"},
"company": {
"id": 4564,
"title": "Бизнес образец",
"country_id": 1,
"city_id": 2,
"timezone": 3,
"address": "",
"coordinate_lat": "25.247901",
"coordinate_lon": "55.275397399999974",
"logo": "https://yclients.com/uploads/s_120d9410f1472a4e6bdbafefe7eeba42.png",
"zip": "",
"phones": [ ],
"site": ""},
"user": {
"id": "999290",
"name": "User name",
"phone": "70000000001"}},
"meta": [ ]}`

## [tag/Dokumenty-skladskih-operacij/operation/Удалить документ](https://developers.yclients.com/ru/\#tag/Dokumenty-skladskih-operacij/operation/%D0%A3%D0%B4%D0%B0%D0%BB%D0%B8%D1%82%D1%8C%20%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82) Удалить документ

delete/storage\_operations/documents/{company\_id}/{document\_id}

https://api.yclients.com/api/v1/storage\_operations/documents/{company\_id}/{document\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| document\_id<br>required | number<br>ID документа |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**202**
Accepted

## [tag/Dokumenty-skladskih-operacij/operation/Получить финансовые транзакции документа](https://developers.yclients.com/ru/\#tag/Dokumenty-skladskih-operacij/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%84%D0%B8%D0%BD%D0%B0%D0%BD%D1%81%D0%BE%D0%B2%D1%8B%D0%B5%20%D1%82%D1%80%D0%B0%D0%BD%D0%B7%D0%B0%D0%BA%D1%86%D0%B8%D0%B8%20%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%B0) Получить финансовые транзакции документа

get/storage\_operations/documents/finance\_transactions/{document\_id}

https://api.yclients.com/api/v1/storage\_operations/documents/finance\_transactions/{document\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| document\_id<br>required | number<br>ID документа |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 9053737,\
"date": "2023-01-01 10:00:00",\
"type_id": 2640,\
"expense_id": 2640,\
"account_id": 35501,\
"amount": 434,\
"client_id": 4240788,\
"master_id": 0,\
"supplier_id": 0,\
"comment": "Transaction comment",\
"item_id": 0,\
"target_type_id": 0,\
"record_id": 0,\
"expense": {\
"id": 2640,\
"title": "Оказание корпоративных услуг"},\
"account": {\
"id": 35501,\
"title": "Касса",\
"type_id": 0,\
"type": 0,\
"comment": "",\
"company_id": 4564},\
"client": {\
"id": "4240788",\
"name": "Client",\
"phone": "71000000001"},\
"master": [ ],\
"supplier": [ ]},\
{\
"id": 9053738,\
"date": "2023-01-01 10:00:00",\
"type_id": 2640,\
"expense_id": 2640,\
"account_id": 35501,\
"amount": 434,\
"client_id": 4240788,\
"master_id": 0,\
"supplier_id": 0,\
"comment": "Transaction comment",\
"item_id": 0,\
"target_type_id": 0,\
"record_id": 0,\
"expense": {\
"id": 2640,\
"title": "Оказание корпоративных услуг"},\
"account": {\
"id": 35501,\
"title": "Касса",\
"type_id": 0,\
"type": 0,\
"comment": "",\
"company_id": 4564},\
"client": {\
"id": "4240788",\
"name": "Client",\
"phone": "71000000001"},\
"master": [ ],\
"supplier": [ ]}],
"meta": [ ]}`

## [tag/Dokumenty-skladskih-operacij/operation/Получить товарные транзакции документа](https://developers.yclients.com/ru/\#tag/Dokumenty-skladskih-operacij/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%82%D0%BE%D0%B2%D0%B0%D1%80%D0%BD%D1%8B%D0%B5%20%D1%82%D1%80%D0%B0%D0%BD%D0%B7%D0%B0%D0%BA%D1%86%D0%B8%D0%B8%20%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%B0) Получить товарные транзакции документа

get/storage\_operations/documents/goods\_transactions/{document\_id}

https://api.yclients.com/api/v1/storage\_operations/documents/goods\_transactions/{document\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| document\_id<br>required | number<br>ID документа |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | object<br>Метаданные (количество найденных транзакций) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 3728232,\
"document_id": 22256643,\
"type_id": 1,\
"company_id": 4564,\
"good_id": 587018,\
"amount": -10,\
"cost_per_unit": 100,\
"discount": 0,\
"cost": 1000,\
"unit_id": 88272,\
"operation_unit_type": 1,\
"storage_id": 36539,\
"supplier_id": 0,\
"record_id": 0,\
"client_id": 0,\
"master_id": 49754,\
"create_date": 1499370120,\
"comment": "",\
"service_id": 0,\
"user_id": 3,\
"deleted": false,\
"pkg_amount": 0},\
{\
"id": 3728233,\
"document_id": 22256643,\
"type_id": 1,\
"company_id": 4564,\
"good_id": 232674,\
"amount": -10,\
"cost_per_unit": 127.5,\
"discount": 0,\
"cost": 1275,\
"unit_id": 1,\
"operation_unit_type": 2,\
"storage_id": 36539,\
"supplier_id": 0,\
"record_id": 0,\
"client_id": 0,\
"master_id": 49754,\
"create_date": 1499370120,\
"comment": "",\
"service_id": 0,\
"user_id": 3,\
"deleted": false,\
"pkg_amount": 0}],
"meta": {
"count": 2}}`

# [tag/Lichnye-scheta](https://developers.yclients.com/ru/\#tag/Lichnye-scheta) Личные счета

## [tag/Lichnye-scheta/operation/Создание операции пополнения личного счёта](https://developers.yclients.com/ru/\#tag/Lichnye-scheta/operation/%D0%A1%D0%BE%D0%B7%D0%B4%D0%B0%D0%BD%D0%B8%D0%B5%20%D0%BE%D0%BF%D0%B5%D1%80%D0%B0%D1%86%D0%B8%D0%B8%20%D0%BF%D0%BE%D0%BF%D0%BE%D0%BB%D0%BD%D0%B5%D0%BD%D0%B8%D1%8F%20%D0%BB%D0%B8%D1%87%D0%BD%D0%BE%D0%B3%D0%BE%20%D1%81%D1%87%D1%91%D1%82%D0%B0) Создание операции пополнения личного счёта

post/deposits\_operations/{salon\_id}

https://api.yclients.com/api/v1/deposits\_operations/{salon\_id}

Создание операции с личным счётом предполагает создание документа, транзакции с личным счётом и финансовой транзакции в рамках одного запроса к API.

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| salon\_id<br>required | number<br>ID филиала |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: \*/\*

|     |     |
| --- | --- |
| client\_id<br>required | number<br>ID клиента, владельца личного счёта |
| deposit\_id<br>required | number<br>ID личного счёта |
| amount<br>required | number<br>сумма пополнения |
| master\_id | number<br>ID сотрудника |
| account\_id<br>required | number<br>ID кассы для оплаты |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"document": {
"id": 1,
"user_id": 1,
"salon_id": 1,
"type_id": 9,
"type": {
"id": 9,
"title": "Пополнение счета (аванс)"},
"comment": "",
"number": 1,
"salon": {
"id": 1,
"title": "Филиал в Москве (Выползов 8)",
"public_title": "Филиал в Москве (Выползов 8)",
"business_group_id": 1,
"business_type_id": 1,
"country_id": 1,
"city_id": 2,
"timezone": 3,
"timezone_name": "Europe/Moscow",
"address": "Москва, Выползов переулок 8",
"coordinate_lat": 55.7794763,
"coordinate_lon": 37.6287021,
"logo": "http://yclients.com/images/icon.png",
"zip": "129090",
"phone": "79169887573",
"phones": [\
"79169887573",\
"79178335390"],
"site": "",
"allow_delete_record": true,
"allow_change_record": true},
"user": {
"id": 1,
"name": "Вадим",
"phone": "79169887573"}},
"deposits_transactions": [\
{\
"id": 1,\
"salon_id": 1,\
"salon_group_id": 1,\
"document_id": 1,\
"deposit_id": 1,\
"deposit_type_id": 1,\
"master_id": 1,\
"user_id": 1,\
"amount": 100.5,\
"comment": "",\
"date_create": 1570982400,\
"deleted": false,\
"deposit": {\
"id": 1,\
"deposit_type_id": 1,\
"salon_group_id": 1,\
"initial_balance": 10000,\
"balance": 12239.56,\
"blocked": false,\
"date_create": 1569513600},\
"deposit_type": {\
"id": 1,\
"salon_group_id": 1,\
"title": "Тип счета 1",\
"date_create": 1568988000,\
"deleted": false}}],
"payment_transactions": [\
{\
"id": 1,\
"document_id": 1,\
"date": 1570993200,\
"type_id": 10,\
"expense_id": 10,\
"account_id": 1,\
"amount": 100.5,\
"client_id": 1,\
"master_id": 1,\
"supplier_id": 0,\
"comment": "",\
"item_id": 1,\
"target_type_id": 0,\
"record_id": 0,\
"goods_transaction_id": 0,\
"type": {\
"id": 10,\
"title": "Пополнение счета"}}]},
"meta": [ ]}`

## [tag/Lichnye-scheta/operation/Получение списка личных счетов по филиалу и клиенту](https://developers.yclients.com/ru/\#tag/Lichnye-scheta/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B5%D0%BD%D0%B8%D0%B5%20%D1%81%D0%BF%D0%B8%D1%81%D0%BA%D0%B0%20%D0%BB%D0%B8%D1%87%D0%BD%D1%8B%D1%85%20%D1%81%D1%87%D0%B5%D1%82%D0%BE%D0%B2%20%D0%BF%D0%BE%20%D1%84%D0%B8%D0%BB%D0%B8%D0%B0%D0%BB%D1%83%20%D0%B8%20%D0%BA%D0%BB%D0%B8%D0%B5%D0%BD%D1%82%D1%83) Получение списка личных счетов по филиалу и клиенту

get/deposits/company/{company\_id}/client/{client\_id}

https://api.yclients.com/api/v1/deposits/company/{company\_id}/client/{client\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID филиала |
| client\_id<br>required | number<br>ID клиента |

##### header Parameters

|     |     |
| --- | --- |
| Accept | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |

### Responses

**200**
OK

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"deposit": {\
"id": 1,\
"salon_group_id": 1,\
"deposit_type_id": 1,\
"initial_balance": 0,\
"balance": 1000,\
"blocked": false,\
"date_create": 1575635420},\
"deposit_type": {\
"id": 1,\
"salon_group_id": 1,\
"title": "Заголовок типа счета",\
"date_create": 1575635420,\
"deleted": false}}],
"meta": {
"count": 1}}`

## [tag/Lichnye-scheta/operation/Получение списка личных счетов по сети и набору фильтров](https://developers.yclients.com/ru/\#tag/Lichnye-scheta/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B5%D0%BD%D0%B8%D0%B5%20%D1%81%D0%BF%D0%B8%D1%81%D0%BA%D0%B0%20%D0%BB%D0%B8%D1%87%D0%BD%D1%8B%D1%85%20%D1%81%D1%87%D0%B5%D1%82%D0%BE%D0%B2%20%D0%BF%D0%BE%20%D1%81%D0%B5%D1%82%D0%B8%20%D0%B8%20%D0%BD%D0%B0%D0%B1%D0%BE%D1%80%D1%83%20%D1%84%D0%B8%D0%BB%D1%8C%D1%82%D1%80%D0%BE%D0%B2) Получение списка личных счетов по сети и набору фильтров

get/deposits/chain/{chain\_id}

https://api.yclients.com/api/v1/deposits/chain/{chain\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| chain\_id<br>required | number<br>ID сети |

##### query Parameters

|     |     |
| --- | --- |
| balance\_from | number<br>Минимальный баланс для фильтрации |
| balance\_to | number<br>Максимальный баланс для фильтрации |
| page | number<br>Номер страницы |
| limit | number<br>Количество элементов на странице |

##### header Parameters

|     |     |
| --- | --- |
| Accept | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |

### Responses

**200**
OK

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"deposit": {\
"id": 1,\
"salon_group_id": 1,\
"deposit_type_id": 1,\
"initial_balance": 0,\
"balance": 1000,\
"blocked": false,\
"date_create": 1575635420},\
"deposit_type": {\
"id": 1,\
"salon_group_id": 1,\
"title": "Заголовок типа счета",\
"date_create": 1575635420,\
"deleted": false},\
"client": {\
"id": 1,\
"name": "Имя клиента",\
"phone": 71234567890}}],
"meta": {
"count": 1}}`

## [tag/Lichnye-scheta/operation/Получение списка личных счетов по сети и номеру телефона клиента](https://developers.yclients.com/ru/\#tag/Lichnye-scheta/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B5%D0%BD%D0%B8%D0%B5%20%D1%81%D0%BF%D0%B8%D1%81%D0%BA%D0%B0%20%D0%BB%D0%B8%D1%87%D0%BD%D1%8B%D1%85%20%D1%81%D1%87%D0%B5%D1%82%D0%BE%D0%B2%20%D0%BF%D0%BE%20%D1%81%D0%B5%D1%82%D0%B8%20%D0%B8%20%D0%BD%D0%BE%D0%BC%D0%B5%D1%80%D1%83%20%D1%82%D0%B5%D0%BB%D0%B5%D1%84%D0%BE%D0%BD%D0%B0%20%D0%BA%D0%BB%D0%B8%D0%B5%D0%BD%D1%82%D0%B0) Получение списка личных счетов по сети и номеру телефона клиента

get/deposits/chain/{chain\_id}/phone/{phone}

https://api.yclients.com/api/v1/deposits/chain/{chain\_id}/phone/{phone}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| chain\_id<br>required | number<br>ID сети |
| phone<br>required | number<br>Номер телефона клиента |

##### header Parameters

|     |     |
| --- | --- |
| Accept | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |

### Responses

**200**
OK

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"deposit": {\
"id": 1,\
"salon_group_id": 1,\
"deposit_type_id": "1,",\
"initial_balance": 0,\
"balance": 1000,\
"blocked": false,\
"date_create": 1575635420},\
"deposit_type": {\
"id": 1,\
"salon_group_id": 1,\
"title": "Заголовок типа счета",\
"date_create": 1575635420,\
"deleted": false}}],
"meta": {
"count": 1}}`

## [tag/Lichnye-scheta/operation/api.chain.deposits.salon_group.deposit_history](https://developers.yclients.com/ru/\#tag/Lichnye-scheta/operation/api.chain.deposits.salon_group.deposit_history) Получение истории операции личного счета

get/deposits/chain/{chain\_id}/deposit\_history/{deposit\_id}

https://api.yclients.com/api/v1/deposits/chain/{chain\_id}/deposit\_history/{deposit\_id}

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| chain\_id<br>required | number<br>ID сети |
| deposit\_id<br>required | number<br>ID личного счета |

##### header Parameters

|     |     |
| --- | --- |
| Accept | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | Array of objects |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Response samples

- 200
- 401
- 403
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"deposit_transaction": {\
"id": 1,\
"salon_id": 1,\
"salon_group_id": 1,\
"user_id": 1,\
"amount": 100,\
"date_create": "2019-12-23T13:41:16.000000Z",\
"comment": "Пополнение",\
"deleted": false},\
"deposit_transaction_type": {\
"id": 1,\
"title": "Пополнение"}}],
"meta": { }}`

# [tag/Strany](https://developers.yclients.com/ru/\#tag/Strany) Страны

Объект страны имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | ID страны |
| title | string | Краткое название страны |
| full\_title | string | Полное название страны |
| phone\_code | number | Телефонный код |
| phone\_template | string | Шаблон номера телефона страны |
| phone\_example | string | Пример номера телефона страны |
| currency | string | Валюта |
| exchange | float | Ставка обмена валют по отношению к рублю |

## [tag/Strany/operation/Получить список стран](https://developers.yclients.com/ru/\#tag/Strany/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%BE%D0%BA%20%D1%81%D1%82%D1%80%D0%B0%D0%BD) Получить список стран

get/countries

https://api.yclients.com/api/v1/countries

##### Authorizations:

_bearer_

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": "1",\
"title": "Россия",\
"full_title": "Российская Федерация",\
"phone_code": "7",\
"phone_template": "+7 xxx xxx-xx-xx",\
"phone_example": "+7 981 123 45-67",\
"currency": "₽",\
"exchange": "1"},\
{\
"id": "2",\
"title": "Латвия",\
"full_title": "Латвийская Республика",\
"phone_code": "371",\
"phone_template": "+371 xx xxx xxx",\
"phone_example": "+371 21 654 987",\
"currency": "€",\
"exchange": "50"}],
"meta": [ ]}`

# [tag/Goroda](https://developers.yclients.com/ru/\#tag/Goroda) Города

Объект города имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | ID города |
| title | string | Краткое название города |
| country\_id | number | ID страны |

## [tag/Goroda/operation/Получить список городов](https://developers.yclients.com/ru/\#tag/Goroda/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%BE%D0%BA%20%D0%B3%D0%BE%D1%80%D0%BE%D0%B4%D0%BE%D0%B2) Получить список городов

get/cities?country\_id=1&company\_id=1

https://api.yclients.com/api/v1/cities?country\_id=1&company\_id=1

##### Authorizations:

_bearer_

##### query Parameters

|     |     |
| --- | --- |
| country\_id | number<br>ID страны, из которой нужно получить города |
| company\_id | number<br>ID филиала. Если передан, будет возвращен так же город филиала, независимо от того, относится он к указанной стране или нет |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 2,\
"country_id": 1,\
"title": "Москва"},\
{\
"id": 1,\
"country_id": 1,\
"title": "Санкт-Петербург"},\
{\
"id": 1040,\
"country_id": 30,\
"title": "Belfast"},\
{\
"id": 1201,\
"country_id": 38,\
"title": "București"},\
{\
"id": 1334,\
"country_id": 31,\
"title": "Budapest"}],
"meta": [ ]}`

# [tag/Izobrazheniya](https://developers.yclients.com/ru/\#tag/Izobrazheniya) Изображения

## [tag/Izobrazheniya/operation/Загрузка изображения](https://developers.yclients.com/ru/\#tag/Izobrazheniya/operation/%D0%97%D0%B0%D0%B3%D1%80%D1%83%D0%B7%D0%BA%D0%B0%20%D0%B8%D0%B7%D0%BE%D0%B1%D1%80%D0%B0%D0%B6%D0%B5%D0%BD%D0%B8%D1%8F) Загрузка изображения

post/images/{entity}

https://api.yclients.com/api/v1/images/{entity}

Объект ответа имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| image\_binded | boolean | Статус привязки изображений к сущности |
| image\_group | object | Объект группа изображений |

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| entity<br>required | string<br>Example:"master"<br>название сущности (master/service) |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>form-data |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: multipart/form-data

|     |     |
| --- | --- |
| company\_id | number<br>ID салона для привязки изображения (для entity=service) |
| service\_id | number<br>ID услуги для привязки изображения (для entity=service) |
| master\_id | number<br>ID сотрудника для привязки изображения (для entity=master) |
| image<br>required | string<br>передаваемое изображение (image/jpeg, image/png) |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| ImageGroup | object (ImageGroup) |
| image\_group<br>required | object (ImageGroup) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"image_binded": false,
"image_group ": {
"id": 72256,
"entity": "",
"entity_id": 0,
"images": {
"basic": {
"id": 186826,
"path": "https://yclients.com/uploads/setting_service_image/c/cf/cf01a5585348731_20170328195919.jpeg",
"width": 373,
"height": 280,
"type": "jpeg",
"image_group_id": 72256,
"version": "basic"}}}},
"meta": [ ]}`

## [tag/Izobrazheniya/operation/Удаление изображений](https://developers.yclients.com/ru/\#tag/Izobrazheniya/operation/%D0%A3%D0%B4%D0%B0%D0%BB%D0%B5%D0%BD%D0%B8%D0%B5%20%D0%B8%D0%B7%D0%BE%D0%B1%D1%80%D0%B0%D0%B6%D0%B5%D0%BD%D0%B8%D0%B9) Удаление изображений

delete/images/{entity}

https://api.yclients.com/api/v1/images/{entity}

Объект ответа имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| success | boolean | Результат удаления |

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| entity<br>required | string<br>название сущности (master/service) |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>form-data |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: multipart/form-data

|     |     |
| --- | --- |
| image\_group\_id<br>required | number<br>ID группы изображения для удаления |

### Responses

**200**
OK

# [tag/Seti-salonov](https://developers.yclients.com/ru/\#tag/Seti-salonov) Сети салонов

## [tag/Seti-salonov/operation/Получение доступных пользователю сетей](https://developers.yclients.com/ru/\#tag/Seti-salonov/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B5%D0%BD%D0%B8%D0%B5%20%D0%B4%D0%BE%D1%81%D1%82%D1%83%D0%BF%D0%BD%D1%8B%D1%85%20%D0%BF%D0%BE%D0%BB%D1%8C%D0%B7%D0%BE%D0%B2%D0%B0%D1%82%D0%B5%D0%BB%D1%8E%20%D1%81%D0%B5%D1%82%D0%B5%D0%B9) Получение доступных пользователю сетей

get/groups

https://api.yclients.com/api/v1/groups

Объект сети салонов имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | Id сети салонов |
| title | string | Название сети салонов |
| companies | array | Список салонов сети |
| access | object | Объект с правами доступа для управления сетью |

##### Authorizations:

(_bearer__user_)

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 509,\
"title": "Сеть салонов в Санкт-Петербурге",\
"companies": [\
{\
"id": 38726,\
"title": "Салон в Санкт-Петербурге (Лиговский пр. 73)"},\
{\
"id": 39287,\
"title": "Салон в Санкт-Петербурге (Невский пр. 38)"}],\
"access": {\
"settings_access": "1",\
"clients_access": "1",\
"users_access": "1",\
"loyalty_access": "1",\
"loyalty_cards_manual_transactions_access": "1",\
"network_services_access": "1"}},\
{\
"id": 508,\
"title": "Сеть салонов в Москве",\
"companies": [\
{\
"id": 38545,\
"title": "Салон в Москве (Тверская 33)"},\
{\
"id": 38704,\
"title": "Салон в Москве (Гагарина пл. 27)"}],\
"access": {\
"settings_access": "1",\
"clients_access": "1",\
"users_access": "1",\
"loyalty_access": "1",\
"loyalty_cards_manual_transactions_access": "1",\
"network_services_access": "1"}}]}`

# [tag/Analitika](https://developers.yclients.com/ru/\#tag/Analitika) Аналитика

Сводные и статистические данные

## [tag/Analitika/paths/~1company~1{company_id}~1analytics~1overall~1/get](https://developers.yclients.com/ru/\#tag/Analitika/paths/~1company~1{company_id}~1analytics~1overall~1/get) Получить основные показатели компании

get/company/{company\_id}/analytics/overall/

https://api.yclients.com/api/v1/company/{company\_id}/analytics/overall/

Метод позволяет получить основные показатели компании за выбранный период и сравнить с предыдущим периодом той же длительности

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Идентификатор компании |

##### query Parameters

|     |     |
| --- | --- |
| date\_from<br>required | string<date><br>Дата начала анализируемого периода |
| date\_to<br>required | string<date><br>Дата окончания анализируемого периода (включается в отчет) |
| staff\_id | integer<br>Идентификатор сотрудника компании, работу которого нужно анализировать |
| position\_id | integer<br>Идентификатор должности компании для анализа работы всех сотрудников, относящихся к одной должности |
| user\_id | integer<br>Идентификатор пользователя компании, работу которого нужно анализировать |

### Responses

**200**
Основные показатели

##### Response Schema: application/json

|     |     |
| --- | --- |
| data<br>required | object (AnalyticsReportOverallStats) <br>Сводные показатели |
| meta<br>required | Array of objects<br>Метаданные |
| success<br>required | boolean<br>Статус успешности выполнения (true) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"data": {
"income_total_stats": {
"current_sum": "12.56",
"previous_sum": "10.34",
"change_percent": 21,
"currency": {
"symbol": "₽"}},
"income_services_stats": {
"current_sum": "12.56",
"previous_sum": "10.34",
"change_percent": 21,
"currency": {
"symbol": "₽"}},
"income_goods_stats": {
"current_sum": "12.56",
"previous_sum": "10.34",
"change_percent": 21,
"currency": {
"symbol": "₽"}},
"income_average_stats": {
"current_sum": "12.56",
"previous_sum": "10.34",
"change_percent": 21,
"currency": {
"symbol": "₽"}},
"income_average_services_stats": {
"current_sum": "12.56",
"previous_sum": "10.34",
"change_percent": 21,
"currency": {
"symbol": "₽"}},
"fullness_stats": {
"current_percent": 12.1,
"previous_percent": 10.2,
"change_percent": 18},
"record_stats": {
"current_completed_count": 150,
"current_completed_percent": 75,
"current_pending_count": 30,
"current_pending_percent": 15,
"current_canceled_count": 20,
"current_canceled_percent": 10,
"current_total_count": 200,
"previous_total_count": 180,
"change_percent": 11},
"client_stats": {
"total_count": 1000,
"new_count": 50,
"new_percent": 10,
"return_count": 450,
"return_percent": 90,
"active_count": 500,
"lost_count": 20,
"lost_percent": 2}},
"meta": [\
{ }],
"success": true}`

## [tag/Analitika/paths/~1company~1{company_id}~1analytics~1overall~1charts~1income_daily~1/get](https://developers.yclients.com/ru/\#tag/Analitika/paths/~1company~1{company_id}~1analytics~1overall~1charts~1income_daily~1/get) Получить данные о выручке в разрезе по дням

get/company/{company\_id}/analytics/overall/charts/income\_daily/

https://api.yclients.com/api/v1/company/{company\_id}/analytics/overall/charts/income\_daily/

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Идентификатор компании |

##### query Parameters

|     |     |
| --- | --- |
| date\_from<br>required | string<date><br>Дата начала анализируемого периода |
| date\_to<br>required | string<date><br>Дата окончания анализируемого периода (включается в отчет) |
| staff\_id | integer<br>Идентификатор сотрудника компании, работу которого нужно анализировать |
| position\_id | integer<br>Идентификатор должности компании для анализа работы всех сотрудников, относящихся к одной должности |
| user\_id | integer<br>Идентификатор пользователя компании, работу которого нужно анализировать |

### Responses

**200**
Выручка в разрезе по дням

##### Response Schema: application/json

Array

|     |     |
| --- | --- |
| label | string<br>Название ряда данных |
| data | Array of integers (AnalyticsReportOverallChartDailyRowItem) \[ items <int32 >\[ items <int32 > \] \]<br>Данные за каждый день. Каждый день \- это массив из двух чисел. Первое число \- timestamp начала дня в зоне UTC, второе число - значение показателя в этот день. |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`[\
{\
"label": "Выручка",\
"data": [\
[\
1635465600000,\
1000],\
[\
1635552000000,\
500]]}]`

## [tag/Analitika/paths/~1company~1{company_id}~1analytics~1overall~1charts~1records_daily~1/get](https://developers.yclients.com/ru/\#tag/Analitika/paths/~1company~1{company_id}~1analytics~1overall~1charts~1records_daily~1/get) Получить данные о количестве записей в разрезе по дням

get/company/{company\_id}/analytics/overall/charts/records\_daily/

https://api.yclients.com/api/v1/company/{company\_id}/analytics/overall/charts/records\_daily/

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Идентификатор компании |

##### query Parameters

|     |     |
| --- | --- |
| date\_from<br>required | string<date><br>Дата начала анализируемого периода |
| date\_to<br>required | string<date><br>Дата окончания анализируемого периода (включается в отчет) |
| staff\_id | integer<br>Идентификатор сотрудника компании, работу которого нужно анализировать |
| user\_id | integer<br>Идентификатор пользователя компании, работу которого нужно анализировать |

### Responses

**200**
Количество записей в разрезе по дням

##### Response Schema: application/json

Array

|     |     |
| --- | --- |
| label | string<br>Название ряда данных |
| data | Array of integers (AnalyticsReportOverallChartDailyRowItem) \[ items <int32 >\[ items <int32 > \] \]<br>Данные за каждый день. Каждый день \- это массив из двух чисел. Первое число \- timestamp начала дня в зоне UTC, второе число - значение показателя в этот день. |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`[\
{\
"label": "Количество записей",\
"data": [\
[\
1635465600000,\
1000],\
[\
1635552000000,\
500]]},\
{\
"label": "Количество онлайн-записей",\
"data": [\
[\
1635465600000,\
1000],\
[\
1635552000000,\
500]]},\
{\
"label": "Количество записей новых клиентов",\
"data": [\
[\
1635465600000,\
1000],\
[\
1635552000000,\
500]]}]`

## [tag/Analitika/paths/~1company~1{company_id}~1analytics~1overall~1charts~1fullness_daily~1/get](https://developers.yclients.com/ru/\#tag/Analitika/paths/~1company~1{company_id}~1analytics~1overall~1charts~1fullness_daily~1/get) Получить данные о заполненности в разрезе по дням

get/company/{company\_id}/analytics/overall/charts/fullness\_daily/

https://api.yclients.com/api/v1/company/{company\_id}/analytics/overall/charts/fullness\_daily/

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Идентификатор компании |

##### query Parameters

|     |     |
| --- | --- |
| date\_from<br>required | string<date><br>Дата начала анализируемого периода |
| date\_to<br>required | string<date><br>Дата окончания анализируемого периода (включается в отчет) |
| staff\_id | integer<br>Идентификатор сотрудника компании, работу которого нужно анализировать |
| user\_id | integer<br>Идентификатор пользователя компании, работу которого нужно анализировать |

### Responses

**200**
Заполненность в разрезе по дням

##### Response Schema: application/json

Array

|     |     |
| --- | --- |
| label | string<br>Название ряда данных |
| data | Array of integers (AnalyticsReportOverallChartDailyRowItem) \[ items <int32 >\[ items <int32 > \] \]<br>Данные за каждый день. Каждый день \- это массив из двух чисел. Первое число \- timestamp начала дня в зоне UTC, второе число - значение показателя в этот день. |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`[\
{\
"label": "Заполненность рабочего дня, %",\
"data": [\
[\
1635465600000,\
89.7],\
[\
1635552000000,\
91.2]]}]`

## [tag/Analitika/paths/~1company~1{company_id}~1analytics~1overall~1charts~1record_source~1/get](https://developers.yclients.com/ru/\#tag/Analitika/paths/~1company~1{company_id}~1analytics~1overall~1charts~1record_source~1/get) Получить структуру записей по источникам

get/company/{company\_id}/analytics/overall/charts/record\_source/

https://api.yclients.com/api/v1/company/{company\_id}/analytics/overall/charts/record\_source/

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Идентификатор компании |

##### query Parameters

|     |     |
| --- | --- |
| date\_from<br>required | string<date><br>Дата начала анализируемого периода |
| date\_to<br>required | string<date><br>Дата окончания анализируемого периода (включается в отчет) |
| staff\_id | integer<br>Идентификатор сотрудника компании, работу которого нужно анализировать |
| user\_id | integer<br>Идентификатор пользователя компании, работу которого нужно анализировать |

### Responses

**200**
Структура записей по источникам

##### Response Schema: application/json

Array

|     |     |
| --- | --- |
| label | string<br>Название показателя |
| data | integer<br>Значение показателя |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`[\
{\
"label": "Администратор",\
"data": 10},\
{\
"label": "Виджет",\
"data": 30}]`

## [tag/Analitika/paths/~1company~1{company_id}~1analytics~1overall~1charts~1record_status~1/get](https://developers.yclients.com/ru/\#tag/Analitika/paths/~1company~1{company_id}~1analytics~1overall~1charts~1record_status~1/get) Получить структуру записей по статусам визитов

get/company/{company\_id}/analytics/overall/charts/record\_status/

https://api.yclients.com/api/v1/company/{company\_id}/analytics/overall/charts/record\_status/

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Идентификатор компании |

##### query Parameters

|     |     |
| --- | --- |
| date\_from<br>required | string<date><br>Дата начала анализируемого периода |
| date\_to<br>required | string<date><br>Дата окончания анализируемого периода (включается в отчет) |
| staff\_id | integer<br>Идентификатор сотрудника компании, работу которого нужно анализировать |
| user\_id | integer<br>Идентификатор пользователя компании, работу которого нужно анализировать |

### Responses

**200**
Структура записей по статусам визитов

##### Response Schema: application/json

Array

|     |     |
| --- | --- |
| label | string<br>Название показателя |
| data | integer<br>Значение показателя |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`[\
{\
"label": "Ожидание клиента",\
"data": 10},\
{\
"label": "Клиент пришёл",\
"data": 30},\
{\
"label": "Клиент подтвердил",\
"data": 5},\
{\
"label": "Клиент не пришёл",\
"data": 2}]`

# [tag/Z-Otchet](https://developers.yclients.com/ru/\#tag/Z-Otchet) Z-Отчет

Объект Z-Отчета имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| stats | stats | Общая статистика |
| paids | paids | Оплаты |
| z\_data | z\_data | Данные отчета |
| currency | string | Валюта |

Объект stats имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| clients | integer | Количество клиентов |
| clients\_average | float | Среддняя оплата по клиентам |
| records | integer | Количество записей |
| records\_average | float | Среддняя оплата по записям |
| visit\_records | integer | Количество записей с клиентами |
| visit\_records\_average | float | Среддняя оплата по записям с клиентами |
| non\_visit\_records | integer | Количество записей без клиентов |
| non\_visit\_records\_average | float | Среддняя оплата по записям без клиентов |
| targets | integer | Количество услуг |
| targets\_paid | float | Оплата по услугам |
| goods | integer | Количество товаров |
| goods\_paid | float | Оплата по товарам |
| certificates | integer | Количество сертификатов |
| certificates\_paid | float | Оплата по сертификатам |
| abonement | integer | Количество абонементов |
| abonement\_paid | float | Оплата по абонементам |

Объект paids имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| accounts | array of paid | Оплаты в кассы |
| discount | array of paid | Оплата по скидке и лояльности |
| total | total\_paid | Итог |

Объект paid имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| title | string | Название кассы или тип скидки/лояльности |
| amount | float | Сумма оплаты |

Объект total\_paid имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| accounts | float | Общая сумма оплат в кассы |
| discount | float | Общая сумма скидок/лояльности |

Объект z\_data состоит из пар ключ-значение, где:

- ключ \- дата;

- значение \- объект client;


Объект client имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| client\_id | integer | ID клиента (0, если клиент не из базы) |
| client\_name | string | Имя клиента |
| client\_phone | string | Номер телефона клиента |
| client\_email | string | Email клиента |
| masters | array of master | Сотрудники |

Объект master имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| master\_id | integer | ID сотрудника |
| master\_name | string | Имя сотрудника |
| service | array of operation | Услуги |
| good | array of operation | Товары |
| others | operation | Другие операции |

Объект operation имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| item\_title | string | Название услуги/товара |
| first\_cost | integer | Цена |
| discount | integer | Скидка |
| result\_cost | integer | К оплате |
| transactions | array of transaction | Оплаты |

Объект transaction имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| accounts\_amount | integer | Оплачено в кассу |
| loyalty\_amount | integer | Оплачено по программе лояльности |
| payment\_type | string | Тип оплаты |

## [tag/Z-Otchet/operation/Получить данные Z-Отчета](https://developers.yclients.com/ru/\#tag/Z-Otchet/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D0%B4%D0%B0%D0%BD%D0%BD%D1%8B%D0%B5%20Z-%D0%9E%D1%82%D1%87%D0%B5%D1%82%D0%B0) Получить данные Z-Отчета

get/reports/z\_report/{company\_id}

https://api.yclients.com/api/v1/reports/z\_report/{company\_id}

- start\_date: Дата отчета

- master\_id: ID сотрудника


##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | integer<br>ID компании |

##### query Parameters

|     |     |
| --- | --- |
| start\_date | string<br>Example:start\_date=''<br>дата начала периода |
| master\_id | integer<br>Example:master\_id=0<br>ID сотрудника |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"stats": {
"clients": 7,
"clients_average": 123.45,
"records": 14,
"records_average": 4231.51,
"visit_records": 13,
"visit_records_average": 100500.01,
"non_visit_records": 1,
"non_visit_records_average": 200,
"targets": 14,
"targets_paid": 10255,
"goods": 4,
"goods_paid": 12452.18,
"certificates": 1,
"certificates_paid": 9876,
"abonement": 0,
"abonement_paid": 0},
"paids": {
"accounts": [\
{\
"title": "Карты",\
"amount": 6987},\
{\
"title": "Наличные",\
"amount": 54321.13},\
{\
"title": "Касса",\
"amount": 12531}],
"discount": [\
{\
"title": "Предварительная скидка",\
"amount": 1816.875},\
{\
"title": "Списано бонусов",\
"amount": 800},\
{\
"title": "Скидка по акциям",\
"amount": 123}],
"total": {
"accounts": 2657.13,
"discount": 1241.875}},
"z_data": {
"1481101200": [\
{\
"client_id": "11223344",\
"client_name": "John Smith",\
"client_phone": "+7 999 888-77-66",\
"client_email": "",\
"masters": [\
{\
"master_id": "321123",\
"master_name": "Robert Brown",\
"service": [\
{\
"item_title": "Мелирование от 9 прядей",\
"first_cost": 3500,\
"discount": 0,\
"result_cost": 3500,\
"transactions": [\
{\
"accounts_amount": 0,\
"loyalty_amount": 700,\
"payment_type": "Карта: Золотая карта"},\
{\
"accounts_amount": 0,\
"loyalty_amount": 100,\
"payment_type": "Карта: Золотая карта"},\
{\
"accounts_amount": 0,\
"loyalty_amount": 1,\
"payment_type": "Карта: Карта бонусная"}]}],\
"good": [\
{\
"item_title": "Spray For Hair",\
"first_cost": 15,\
"discount": 2.25,\
"result_cost": 12.75,\
"transactions": [\
{\
"accounts_amount": 12.75,\
"loyalty_amount": 0,\
"payment_type": "Наличные"}]}],\
"others": {\
"item_title": "Другие операции",\
"first_cost": 347,\
"discount": 0,\
"result_cost": 347,\
"transactions": [\
{\
"accounts_amount": 23,\
"loyalty_amount": 0,\
"payment_type": "Наличные"},\
{\
"accounts_amount": 324,\
"loyalty_amount": 0,\
"payment_type": "Наличные"}]}}]}]},
"currency": "₽"},
"meta": [ ]}`

# [tag/Dopolnitelnye-polya](https://developers.yclients.com/ru/\#tag/Dopolnitelnye-polya) Дополнительные поля

## [section/Opisanie-funkcionala-i-obuekty-API](https://developers.yclients.com/ru/\#section/Opisanie-funkcionala-i-obuekty-API) Описание функционала и объекты API

### Описание

Дополнительные поля позволяют добавлять к отдельным объектам системы свойства заданного типа и впоследствии привязывать к этим полям значения, соответствующие данному типу. На данный момент функционал реализован для Записей и Клиентов.

Объекты Дополнительных полей:

| Поле | Тип | Описание |
| --- | --- | --- |
| code | string | Код поля по которому устанавливаются значения для полей записи |
| id | integer | Уникальный идентификатор поля |
| type | CustomFieldType | Тип поля |
| show\_in\_ui | boolean | Показывать ли поле в интерфейсе |
| title | string | Название поля |
| user\_can\_edit | boolean | Можно ли редактировать в интерфейсе |
| values | array or null | Список допустимых значений для типа "список" |

На данный момент поддерживаются следующие типы (поле code):

- text - строка длиной до 255 символов

- number - число

- select - список

- date - Дата (Y-m-d)

- datetime - Дата и время (Y-m-d H:i:s)


Следующие коды полей являются зарезервированными:

| code | type | Описание |
| --- | --- | --- |
| yc\_partner\_public\_key | text | Используется для определения партнера при создании записи, является более приоритетным, чем Bearer-токен из авторизации |

## [tag/Dopolnitelnye-polya/operation/Получение коллекции полей филиала](https://developers.yclients.com/ru/\#tag/Dopolnitelnye-polya/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B5%D0%BD%D0%B8%D0%B5%20%D0%BA%D0%BE%D0%BB%D0%BB%D0%B5%D0%BA%D1%86%D0%B8%D0%B8%20%D0%BF%D0%BE%D0%BB%D0%B5%D0%B9%20%D1%84%D0%B8%D0%BB%D0%B8%D0%B0%D0%BB%D0%B0) Получение коллекции полей филиала

get/custom\_fields/{field\_category}/{company\_id}

https://api.yclients.com/api/v1/custom\_fields/{field\_category}/{company\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| field\_category<br>required | string<br>Example:record<br>Категория полей.<br>- Для записей \- record<br>  <br>- Для клиентов \- client |
| company\_id<br>required | integer<br>ID компании |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 1,\
"salon_id": 1,\
"custom_field": {\
"id": 1,\
"code": "my_text_field",\
"show_in_ui": true,\
"title": "поле для теста",\
"user_can_edit": true,\
"type": {\
"code": "text",\
"title": "Текст"}}}],
"meta": [ ]}`

## [tag/Dopolnitelnye-polya/operation/Добавление дополнительного поля](https://developers.yclients.com/ru/\#tag/Dopolnitelnye-polya/operation/%D0%94%D0%BE%D0%B1%D0%B0%D0%B2%D0%BB%D0%B5%D0%BD%D0%B8%D0%B5%20%D0%B4%D0%BE%D0%BF%D0%BE%D0%BB%D0%BD%D0%B8%D1%82%D0%B5%D0%BB%D1%8C%D0%BD%D0%BE%D0%B3%D0%BE%20%D0%BF%D0%BE%D0%BB%D1%8F) Добавление дополнительного поля

post/custom\_fields/{field\_category}/{company\_id}

https://api.yclients.com/api/v1/custom\_fields/{field\_category}/{company\_id}

Для добавления поля пользователь должен быть добавлен в **связанной с филиалом сети**, и иметь права доступа в разделе:

**Настройки \- Доступ к разделу Дополнительные поля \- Создание доп. полей**

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| field\_category<br>required | string<br>Example:record<br>Категория полей.<br>- Для записей \- record<br>  <br>- Для клиентов \- client |
| company\_id<br>required | integer<br>ID компании |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| type<br>required | string<br>Тип поля |
| code<br>required | string<br>Идентификатор поля |
| title<br>required | string<br>Название поля |
| user\_can\_edit<br>required | boolean<br>Может ли пользователь редактировать поле |
| show\_in\_ui<br>required | boolean<br>Показывать ли поле в интерфейсе |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Request samples

- Payload

Content type

application/json

Copy

`{
"type": "text",
"code": "my_text_field",
"title": "поле для теста",
"user_can_edit": true,
"show_in_ui": true}`

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 1,
"salon_id": 1,
"custom_field": {
"id": 1,
"code": "my_text_field",
"show_in_ui": true,
"title": "поле для теста",
"user_can_edit": true,
"type": {
"code": "text",
"title": "Текст"}}},
"meta": [ ]}`

## [tag/Dopolnitelnye-polya/operation/Обновление дополнительного поля](https://developers.yclients.com/ru/\#tag/Dopolnitelnye-polya/operation/%D0%9E%D0%B1%D0%BD%D0%BE%D0%B2%D0%BB%D0%B5%D0%BD%D0%B8%D0%B5%20%D0%B4%D0%BE%D0%BF%D0%BE%D0%BB%D0%BD%D0%B8%D1%82%D0%B5%D0%BB%D1%8C%D0%BD%D0%BE%D0%B3%D0%BE%20%D0%BF%D0%BE%D0%BB%D1%8F) Обновление дополнительного поля

put/custom\_fields/{field\_category}/{company\_id}/{field\_id}

https://api.yclients.com/api/v1/custom\_fields/{field\_category}/{company\_id}/{field\_id}

Для добавления поля пользователь должен быть добавлен в **связанной с филиалом сети**, и иметь права доступа в разделе:

**Настройки \- Доступ к разделу Дополнительные поля \- Изменение доп. полей**

##### path Parameters

|     |     |
| --- | --- |
| field\_category<br>required | string<br>Example:record<br>Категория полей.<br>- Для записей \- record<br>  <br>- Для клиентов \- client |
| company\_id<br>required | integer<br>ID компании |
| field\_id<br>required | integer<br>ID поля |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| type<br>required | string<br>Тип поля |
| code<br>required | string<br>Идентификатор поля |
| title<br>required | string<br>Название поля |
| user\_can\_edit<br>required | boolean<br>Может ли пользователь редактировать поле |
| show\_in\_ui<br>required | boolean<br>Показывать ли поле в интерфейсе |

### Responses

**202**
Accepted

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Request samples

- Payload

Content type

application/json

Copy

`{
"type": "text",
"code": "my_text_field",
"title": "поле для теста",
"user_can_edit": true,
"show_in_ui": true}`

### Response samples

- 202
- 403
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": null,
"meta": {
"message": "Сохранено"}}`

## [tag/Dopolnitelnye-polya/operation/Удаление дополнительного поля из филиала](https://developers.yclients.com/ru/\#tag/Dopolnitelnye-polya/operation/%D0%A3%D0%B4%D0%B0%D0%BB%D0%B5%D0%BD%D0%B8%D0%B5%20%D0%B4%D0%BE%D0%BF%D0%BE%D0%BB%D0%BD%D0%B8%D1%82%D0%B5%D0%BB%D1%8C%D0%BD%D0%BE%D0%B3%D0%BE%20%D0%BF%D0%BE%D0%BB%D1%8F%20%D0%B8%D0%B7%20%D1%84%D0%B8%D0%BB%D0%B8%D0%B0%D0%BB%D0%B0) Удаление дополнительного поля из филиала

delete/custom\_fields/{field\_category}/{company\_id}/{field\_id}

https://api.yclients.com/api/v1/custom\_fields/{field\_category}/{company\_id}/{field\_id}

Для добавления поля пользователь должен быть добавлен в **связанной с филиалом сети**, и иметь права доступа в разделе:

**Настройки \- Доступ к разделу Дополнительные поля \- Удаление доп. полей**

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| field\_category<br>required | string<br>Example:record<br>Категория полей.<br>- Для записей \- record<br>  <br>- Для клиентов \- client |
| company\_id<br>required | integer<br>ID компании |
| field\_id<br>required | integer<br>ID поля |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200
- 403
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": null,
"meta": {
"message": "Удалено"}}`

# [tag/Otpravka-SMS-cherez-operatorov](https://developers.yclients.com/ru/\#tag/Otpravka-SMS-cherez-operatorov) Отправка СМС через операторов

## [section/Opisanie-funkcionala-i-obuekty-API](https://developers.yclients.com/ru/\#section/Opisanie-funkcionala-i-obuekty-API) Описание функционала и объекты API

Для отправки SMS, оператору необходимо предоставить адрес (url\_operator), на который будут уходить запросы описанные ниже.
Авторизация запросов к API производится в соответствии с [RFC 6749 "Resource Owner Password Credentials Grant"](https://tools.ietf.org/html/rfc6749#section-4.3).
При запросах к API в HTTP заголовок Authorization должен быть включен ключ доступа в следущем формате:
Ключ авторизации (partner\_token) должен быть указан в настройках модуля уведомлений компании.

```
Authorization: Bearer <partner token>

```

## [tag/Otpravka-SMS-cherez-operatorov/operation/Отправка СМС](https://developers.yclients.com/ru/\#tag/Otpravka-SMS-cherez-operatorov/operation/%D0%9E%D1%82%D0%BF%D1%80%D0%B0%D0%B2%D0%BA%D0%B0%20%D0%A1%D0%9C%D0%A1) Отправка СМС

post/

https://api.yclients.com/api/v1/

### Отправка СМС

В случае ошибки возвращается ее HTTP-код. В некоторых случаях также возвращается текстовое описание ошибки.
Все методы API могут возвращать следующие коды ошибок:

| Error code | Http status code | Название | Описание |
| --- | --- | --- | --- |
| 5 | 400 | ENTITY\_VALIDATION\_ERROR | Тело запроса не прошло валидацию |
| 10 | 400 | FIELD\_VALIDATION\_ERROR | Параметр не прошел валидацию |
| 32 | 200 | FIELD\_VALIDATION\_ERROR | Недостаточно средств |
| 15 | 403 | ACCESS\_FORBIDDEN | Действие недоступно, у приложения нет требуемых разрешений. |
| 20 | 401 | INVALID\_PARTNER\_TOKEN | partner\_token отсутствует или невалиден |
| 30 | 404 | RESOURCE\_NOT\_FOUND | Ресурс по запрошенному пути не существует |

##### Authorizations:

_bearer_

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token |

##### Request Body schema: \*/\*

|     |     |
| --- | --- |
| destination\_params<br>required | object<br>обьект, содержащий параметры ИД отправки и номер телефона |
| from<br>required | string<br>имя отправителя |
| text<br>required | string<br>текст отправления |
| channel<br>required | string<br>Enum:"whatsapp""sms"<br>Канал отправки |
| dispatch\_type<br>required | string<br>тип рассылки (service - сервисная, adds - рекламная) |
| delivery\_callback\_url<br>required | string<br>url, на который приходят статусы сообщений |

### Responses

**200**
OK

**400**
Bad Request

**401**
Unauthorized

**404**
Not Found

### Response samples

- 200
- 400
- 401
- 404

Content type

application/json

Copy
Expand all  Collapse all

`[\
{\
"id": "232674",\
"ext_id": "609aff0fca92466d6a1747dd83f05943a8c9600d"},\
{\
"id": "232674",\
"error_code": 32,\
"error_message": "explicit error message"}]`

## [tag/Otpravka-SMS-cherez-operatorov/operation/Получение статусов сообщений](https://developers.yclients.com/ru/\#tag/Otpravka-SMS-cherez-operatorov/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B5%D0%BD%D0%B8%D0%B5%20%D1%81%D1%82%D0%B0%D1%82%D1%83%D1%81%D0%BE%D0%B2%20%D1%81%D0%BE%D0%BE%D0%B1%D1%89%D0%B5%D0%BD%D0%B8%D0%B9) Получение статусов сообщений

post/delivery/status

https://api.yclients.com/api/v1/delivery/status

### Получение статусов сообщений

| Номер | Название |
| --- | --- |
| 1 | Доставлено |
| 2 | Не доставлено |
| 4 | Отправлено на телефон |
| 8 | Передано оператору |
| 16 | Отклонено оператором |
| 52 | Недостаточно средств |

В случае ошибки возвращается ее HTTP-код. В некоторых случаях также возвращается текстовое описание ошибки.
Все методы API могут возвращать следующие коды ошибок:

| Error code | Http status code | Название | Описание |
| --- | --- | --- | --- |
| 5 | 400 | ENTITY\_VALIDATION\_ERROR | Тело запроса не прошло валидацию |
| 10 | 400 | FIELD\_VALIDATION\_ERROR | Параметр не прошел валидацию |
| 15 | 403 | ACCESS\_FORBIDDEN | Действие недоступно, у приложения нет требуемых разрешений. |
| 20 | 401 | INVALID\_PARTNER\_TOKEN | partner\_token отсутствует или невалиден |
| 30 | 404 | RESOURCE\_NOT\_FOUND | Ресурс по запрошенному пути не существует |

При отправке смс в запросе передается атрибут delivery\_callback\_url - это url, на который должны приходить статусы сообщений.

Используйте его для отправки статусов сообщений. Url, на который должны приходить статусы сообщений - [https://yclients.com/smsprovider/status/callback/{partner\_token}](https://yclients.com/smsprovider/status/callback/%7Bpartner_token%7D)

##### Authorizations:

_bearer_

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token |

##### Request Body schema: application/json

Array

|     |     |
| --- | --- |
| id | string<br>Идентификатор |
| status | number<br>Статус сообщения |
| payment\_sum | number<br>Полная стоимость сообщения |
| currency\_iso | string<br>ISO валюты платежа (например: RUB, EUR, BYN) |
| parts\_amount | number<br>Количество частей сообщения |

### Responses

**200**
OK

**400**
Bad Request

**401**
Unauthorized

**404**
Not Found

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`[\
{\
"id": "232674",\
"status": 1,\
"payment_sum": 4.54,\
"currency_iso": "RUB",\
"parts_amount": 2}]`

### Response samples

- 200
- 400
- 401
- 404

Content type

application/json

Copy

`{
"success": true}`

# [tag/Licenzii](https://developers.yclients.com/ru/\#tag/Licenzii) Лицензии

При наличии лицензии у компании
объект лицензии имеет следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | number | ID лицензии |
| salon\_id | number | ID компании |
| staff\_limit | number | Количество сотрудников (0 - не ограничено) |
| deactivation\_date | string | Дата деактивации |
| start\_date | string | Дата начала лицензии |
| name | string | Название тарифа лицензии |
| active | boolean | Активность |
| options | array | Массив подключенных опций |

## [tag/Licenzii/operation/Получение информация о лицензии компании](https://developers.yclients.com/ru/\#tag/Licenzii/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B5%D0%BD%D0%B8%D0%B5%20%D0%B8%D0%BD%D1%84%D0%BE%D1%80%D0%BC%D0%B0%D1%86%D0%B8%D1%8F%20%D0%BE%20%D0%BB%D0%B8%D1%86%D0%B5%D0%BD%D0%B7%D0%B8%D0%B8%20%D0%BA%D0%BE%D0%BC%D0%BF%D0%B0%D0%BD%D0%B8%D0%B8) Получение информация о лицензии компании

get/license/{company\_id}

https://api.yclients.com/api/v1/license/{company\_id}

##### Authorizations:

(_bearer__user_)

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| LicenseOption | object (LicenseOption) |
| active<br>required | number<br>Активна ли лицензия |
| deactivation\_date<br>required | string<br>Дата окончания срока действия лицензии |
| id<br>required | number<br>Идентификатор лицензии |
| name<br>required | string<br>Наименование лицезнии |
| options<br>required | Array of objects<br>Опции лицензии |
| salon\_id<br>required | number<br>Идентификатор компании |
| staff\_limit<br>required | number<br>Лимит сотрудников |
| start\_date<br>required | string<br>Дата начала срока действия лицензии |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 1,
"salon_id": 4523464,
"staff_limit": 5,
"deactivation_date": "08.11.2019",
"start_date": "07.05.2018",
"name": "Старт",
"active": 1,
"options": [\
{\
"id": 3,\
"title": "Онлайн-оплата"}]},
"meta": [ ]}`

# [tag/Pravila-obrabotki-personalnyh-dannyh](https://developers.yclients.com/ru/\#tag/Pravila-obrabotki-personalnyh-dannyh) Правила обработки персональных данных

В соответствии с Федеральным законом №152-ФЗ «О персональных данных» от 27.07.2006 г. компании могут заполнить
текст согласия на обработку персональных данных. Текст согласия отображается перед непосредственным подтверждением записи.

## [tag/Pravila-obrabotki-personalnyh-dannyh/operation/Получение информация о правилах обработки персональных данных компании](https://developers.yclients.com/ru/\#tag/Pravila-obrabotki-personalnyh-dannyh/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B5%D0%BD%D0%B8%D0%B5%20%D0%B8%D0%BD%D1%84%D0%BE%D1%80%D0%BC%D0%B0%D1%86%D0%B8%D1%8F%20%D0%BE%20%D0%BF%D1%80%D0%B0%D0%B2%D0%B8%D0%BB%D0%B0%D1%85%20%D0%BE%D0%B1%D1%80%D0%B0%D0%B1%D0%BE%D1%82%D0%BA%D0%B8%20%D0%BF%D0%B5%D1%80%D1%81%D0%BE%D0%BD%D0%B0%D0%BB%D1%8C%D0%BD%D1%8B%D1%85%20%D0%B4%D0%B0%D0%BD%D0%BD%D1%8B%D1%85%20%D0%BA%D0%BE%D0%BC%D0%BF%D0%B0%D0%BD%D0%B8%D0%B8) Получение информация о правилах обработки персональных данных компании

get/privacy\_policy/{company\_id}

https://api.yclients.com/api/v1/privacy\_policy/{company\_id}

##### Authorizations:

_bearer_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Идентификатор компании |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token |

### Responses

**200**
OK

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"agreement": {
"content": "текст соглашения"}},
"meta": [ ]}`

# [tag/Validaciya-dannyh](https://developers.yclients.com/ru/\#tag/Validaciya-dannyh) Валидация данных

## [tag/Validaciya-dannyh/operation/Проверка формата номера телефона](https://developers.yclients.com/ru/\#tag/Validaciya-dannyh/operation/%D0%9F%D1%80%D0%BE%D0%B2%D0%B5%D1%80%D0%BA%D0%B0%20%D1%84%D0%BE%D1%80%D0%BC%D0%B0%D1%82%D0%B0%20%D0%BD%D0%BE%D0%BC%D0%B5%D1%80%D0%B0%20%D1%82%D0%B5%D0%BB%D0%B5%D1%84%D0%BE%D0%BD%D0%B0) Проверка формата номера телефона

get/validation/validate\_phone/{phone}

https://api.yclients.com/api/v1/validation/validate\_phone/{phone}

Происходит проверка переданного номера телефона на соответствие правилам YCLIENTS.

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| phone<br>required | string<br>Проверяемый номер телефона в формате `+71234567890` или `71234567890` |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"is_valid": true},
"meta": [ ]}`

# [tag/Fiskalizaciya-chekov](https://developers.yclients.com/ru/\#tag/Fiskalizaciya-chekov) Фискализация чеков

Система YCLIENTS позволяет партнерам реализовывать API фискализации чеков. В систему добавляется партнер, реализовавший этот API.
После этого у тех пользователей YCLIENTS, которые находятся в той же стране, что и партнер, появляется возможность выбрать
этого партнера в списке возможных решений для фискализации чеков.
Для того, чтобы партнер был добавлен в список возможных решений, он должен связаться с YCLIENTS посредством email: **[partner@yclients.tech](mailto:partner@yclients.tech)**.

YCLIENTS создает [документ продажи](https://developers.yclients.com/ru/#fiscalization-sale-document), и отправляет его на сервер фискализации по адресу, указанному партнером.
Отвечая на HTTP-запрос, сервер фискализации должен вернуть HTTP-ответ со статусом **200** в том случае, если документ успешно получен
и передан в обработку, либо со статусом **400** в случае ошибки.
Тело ответа должно содержать данные [определенного формата](https://developers.yclients.com/ru/#fiscalization-response),
описывающие текущий [статус документа](https://developers.yclients.com/ru/#fiscalization-response-status).
При обновлении статуса сервер фискализации должен отправить [callback запрос](https://developers.yclients.com/ru/#fiscalization-callback) с данными того же [формата](https://developers.yclients.com/ru/#fiscalization-response).

**Документ продажи** имеет следующую структуру:

- Структура документа (json):


```
    {
        "id": "d72fece5-6825-4895-9395-0133195612a4",
        "date": "2020-07-31T14:11:36+04:00",
        "document_id": 239083104,
        "type": "sale",
        "print_receipt": true,
        "customer": {
            "email": "customer@example.com",
            "phone": "91111111111"
        },
        "positions": [\
            {\
                "type": "service",\
                "title": "Consultation",\
                "price": 10.5,\
                "quantity": 1.0,\
                "discount_amount": 2.5,\
                "vat": "ru_vat_10",\
                "payment_method": "payment",\
                "barcode": "12345"\
            }\
        ],
        "payments": [\
            {\
                "type": "card",\
                "sum": 5.5\
            },\
            {\
                "type": "cash",\
                "sum": 4.5\
            },\
            {\
                "type": "prepaid",\
                "sum": 0.5\
            }\
        ],
        "tax": "ru_osn",
        "cashier": {
            "uid": "4895-9395-0133195612a4",
            "name": "John Smith",
            "position": "Cashier"
        },
        "pos": {
            "enabled": true,
            "slip_count": 2
        },
        "callback_url": "https://yclients.com/api/v1/integration/kkm/callback/",
        "custom_text": "some custom text"
    }

```


**Описание полей структуры документа:**

| Поле | Тип | Описание |
| --- | --- | --- |
| id | integer | Уникальный идентификатор документа продажи |
| date | string | Дата и время отправки документа на печать (в формате ISO-8601) |
| document\_id | integer | Внутренний идентификатор документа в системе YCLIENTS |
| type | enum(string) | Тип документа ( [список возможных значений](https://developers.yclients.com/ru/#fiscalization-print-request-type)) |
| print\_receipt | boolean | Печатать ли бумажный чек на кассе при фискализации |
| customer | object( [Customer](https://developers.yclients.com/ru/#fiscalization-print-request-customer)) | Сущность клиента |
| positions | Array of objects( [Position](https://developers.yclients.com/ru/#fiscalization-print-request-position)\[\]) | Список позиций в чеке |
| payments | Array of objects( [Payment](https://developers.yclients.com/ru/#fiscalization-print-request-payment)\[\]) | Список оплат, применяемых на чек |
| tax | enum(string) | Тип системы налогообложения ( **slug** из [списка систем налогообложения](https://developers.yclients.com/ru/#fiscalization-tax)) |
| cashier | object( [Cashier](https://developers.yclients.com/ru/#fiscalization-print-request-cashier)) | Сущность кассира |
| pos | object( [POS](https://developers.yclients.com/ru/#fiscalization-print-request-pos)) | Опции для подключенного POS-терминала |
| callback\_url | string | Ссылка для [обновления статуса фискализации](https://developers.yclients.com/ru/#fiscalization-callback) |
| custom\_text | string \| null | Произвольный текст для печати на чеке |

**Тип документа**

| Значение | Описание |
| --- | --- |
| sale | Приход |
| return | Возврат прихода |

**Сущность клиента** имеет следующую структуру:

| Поле | Тип | Описание |
| --- | --- | --- |
| email | string \| null | E-mail клиента |
| phone | string \| null | Телефон клиента |

**Позиция в чеке** имеет следующую структуру:

| Поле | Тип | Описание |
| --- | --- | --- |
| type | enum(string) | Тип позиции (" **service**" — услуга / " **commodity**" — товар / " **payment**" — платеж) |
| title | string | Название позиции |
| price | float | Цена позиции с точностью 2 знака после запятой |
| quantity | float | Количество |
| discount\_amount | float | Скидка, примененная к позиции с точностью 2 знака после запятой |
| vat | enum(string) | Тип НДС ( **slug** из [списка НДС](https://developers.yclients.com/ru/#fiscalization-vat)) |
| payment\_method | enum(string) | Признак расчета (" **payment**" — оплата / " **prepayment**" — предоплата) |
| barcode | string \| null | Штрихкод товара |

**Оплата, применяемая на чек**, имеет следующую структуру:

| Поле | Тип | Описание |
| --- | --- | --- |
| type | enum(string) | Тип оплаты (" **card**" \- безналичная оплата / " **cash**" — оплата наличными / " **prepaid**" — предварительная оплата) |
| sum | float | Сумма оплаты с точностью 2 знака после запятой |

**Сущность кассира** имеет следующую структуру:

| Поле | Тип | Описание |
| --- | --- | --- |
| id | string | Уникальный идентификатор кассира |
| name | string | Имя кассира |
| position | string | Должность кассира (максимальная длина строки – 64 символа) |

**Опции для подключенного POS-терминала** имеет следующую структуру:

| Поле | Тип | Описание |
| --- | --- | --- |
| enabled | boolean | Надо ли перед фискализацией принять карту через POS-терминал |
| slip\_count | integer | Количество чеков, которые необходимо распечатать после успешной транзакции по POS-терминалу |

**Ответ**, описывающий текущий статус документа, должен содержать идентификатор документа, текущий статус фискализации,
соответствующий статусу [код ответа](https://developers.yclients.com/ru/#fiscalization-response-code),
а также произвольное сообщение, которое может быть показано пользователю или использовано для отладки (например, сообщние об ошибке).

**Ответ** должен иметь следующую структуру:

- Структура ответа (json):


```
    {
        "id": "d72fece5-6825-4895-9395-0133195612a4",
        "status": "error",
        "code": 2002,
        "message": "Кассовое оборудование недоступно по причине..."
    }

```


**Описание полей структуры ответа:**

| Поле | Тип | Описание |
| --- | --- | --- |
| id | integer | Уникальный идентификатор [документа продажи](https://developers.yclients.com/ru/#fiscalization-sale-document) |
| status | enum(string) | Статус печати чека ( [список возможных значений](https://developers.yclients.com/ru/#fiscalization-response-status)) |
| code | enum(integer) | Код ошибки ( [список возможных значений](https://developers.yclients.com/ru/#fiscalization-response-code)) |
| message | string | Детальное сообщние, которое может быть показано пользователю (например, сообщние об ошибке) |

**Статус печати чека**

Статус **pending** должен быть отправлен в ответ на запрос фискализации документа в том случае, если документ успешно получен и находится в обработке.
Статус **success** может быть отправлен в [callback](https://developers.yclients.com/ru/#fiscalization-callback) только при обновлении статуса документа, уже находящегося в статусе **pending**.
В случае ошибки статус **error** может быть отправлен как в ответ на запрос фискализации документа, так и в [callback](https://developers.yclients.com/ru/#fiscalization-callback)

| Значение | Описание |
| --- | --- |
| success | Документ успешно фискализирован (отрпавляется в [callback](https://developers.yclients.com/ru/#fiscalization-callback)) |
| pending | Документ получен и находится в обработке (отправляется в ответ на запрос фискализации документа) |
| error | Произошла ошибка |

**Код ошибки** (код результата обработки запроса)

| Значение | Соответсвует статусу | Описание |
| --- | --- | --- |
| 0 | "success" \| "pending" | Без ошибок |
| 1001 | "error" | Ошибка данных документа |
| 1002 | "error" | Ошибка в позициях документа |
| 1003 | "error" | Ошибка в оплатах документа |
| 1004 | "error" | Ошибка в данных клиента |
| 1005 | "error" | Ошибка в данных кассира |
| 2001 | "error" | Ошибка кассового оборудования |
| 2002 | "error" | Кассовое оборудование недоступно |

## [tag/Fiskalizaciya-chekov/operation/Пример запроса на фискализацию документа](https://developers.yclients.com/ru/\#tag/Fiskalizaciya-chekov/operation/%D0%9F%D1%80%D0%B8%D0%BC%D0%B5%D1%80%20%D0%B7%D0%B0%D0%BF%D1%80%D0%BE%D1%81%D0%B0%20%D0%BD%D0%B0%20%D1%84%D0%B8%D1%81%D0%BA%D0%B0%D0%BB%D0%B8%D0%B7%D0%B0%D1%86%D0%B8%D1%8E%20%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%B0) Пример запроса на фискализацию документа

post/https://your-api.url

https://api.yclients.com/api/v1/https://your-api.url

##### Authorizations:

_bearer_

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| id | string<br>Уникальный идентификатор документа продажи |
| date | string<date-time><br>Дата и время отправки документа на печать (в формате ISO-8601) |
| document\_id | integer<int32><br>Внутренний идентификатор документа в системе YCLIENTS |
| type | string<br>Enum:"sale""return"<br>Тип документа (список возможных значений) |
| print\_receipt | boolean<br>Печатать ли бумажный чек на кассе при фискализации |
| customer | object<br>Сущность клиента |
| positions | Array of objects<br>Список позиций в чеке |
| payments | Array of objects<br>Список оплат, применяемых на чек |
| tax | string<br>Тип системы налогообложения (slug из списка систем налогообложения) |
| cashier | object<br>Сущность кассира |
| pos | object<br>Опции для подключенного POS-терминала |
| callback\_url | string<br>Ссылка для обновления статуса фискализации |
| custom\_text | string<br>Произвольный текст для печати на чеке |

### Responses

**200**
OK

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"id": "d72fece5-6825-4895-9395-0133195612a4",
"date": 1596190296,
"document_id": 239083104,
"type": "sale",
"print_receipt": true,
"customer": {
"email": "customer@example.com",
"phone": "91111111111"},
"positions": [\
{\
"type": "service",\
"title": "Consultation",\
"price": 13.19,\
"quantity": 1,\
"discount_amount": 2.54,\
"vat": "ru_vat_10",\
"payment_method": "payment",\
"barcode": "12345"}],
"payments": [\
{\
"type": "card",\
"sum": 5.55},\
{\
"type": "cash",\
"sum": 4.55},\
{\
"type": "prepaid",\
"sum": 0.55}],
"tax": "ru_osn",
"cashier": {
"uid": "4895-9395-0133195612a4",
"name": "John Smith",
"position": "Cashier"},
"pos": {
"enabled": true,
"slip_count": 2},
"callback_url": "https://yclients.com/api/v1/integration/kkm/callback/",
"custom_text": "some custom text"}`

### Response samples

- 200

Content type

application/json

Copy

`{
"id": "d72fece5-6825-4895-9395-0133195612a4",
"status": "success",
"code": 0,
"message": "OK"}`

## [tag/Fiskalizaciya-chekov/operation/Пример запроса на получение списка](https://developers.yclients.com/ru/\#tag/Fiskalizaciya-chekov/operation/%D0%9F%D1%80%D0%B8%D0%BC%D0%B5%D1%80%20%D0%B7%D0%B0%D0%BF%D1%80%D0%BE%D1%81%D0%B0%20%D0%BD%D0%B0%20%D0%BF%D0%BE%D0%BB%D1%83%D1%87%D0%B5%D0%BD%D0%B8%D0%B5%20%D1%81%D0%BF%D0%B8%D1%81%D0%BA%D0%B0) Пример запроса на получение списка

get/integration/kkm/references/tax\_system/{countryId}

https://api.yclients.com/api/v1/integration/kkm/references/tax\_system/{countryId}

Список доступных для страны **систем налогообложения** и **НДС** можно получить, сделав запрос с указанием идентификатора страны, для которой необходимо получить список.
Идентификатор страны можно получить из [списка стран](https://developers.yclients.com/ru/#countries).

Список представляет собой массив [систем налогообложения](https://developers.yclients.com/ru/#fiscalization-tax) со вложенным массивом [НДС](https://developers.yclients.com/ru/#fiscalization-vat) для каждой системы налогообложения.

**Cистема налогообложения** имеет следующую структуру:

| Поле | Тип | Описание |
| --- | --- | --- |
| title | string | Название системы налогообложения |
| slug | string | Кодовое название системы налогообложения |
| vats | Array of objects( [Vat](https://developers.yclients.com/ru/#fiscalization-vat)\[\]) | Список доступных НДС для системы налогообложения |

**НДС** имеет следующую структуру:

| Поле | Тип | Описание |
| --- | --- | --- |
| title | string | Название НДС |
| slug | string | Кодовое название НДС |

##### Authorizations:

_bearer_

##### path Parameters

|     |     |
| --- | --- |
| countryId<br>required | number<br>Example:1<br>ID страны |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | object<br>Метаданные (содержит количество найденных систем налогообложения) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"title": "Общая ОСН",\
"slug": "ru_osn",\
"vats": [\
{\
"title": "0%",\
"slug": "ru_vat_0"},\
{\
"title": "10%",\
"slug": "ru_vat_10"},\
{\
"title": "20%",\
"slug": "ru_vat_20"},\
{\
"title": "не облагается",\
"slug": "ru_vat_none"}]},\
{\
"title": "Упрощенная УСН (Доход)",\
"slug": "ru_usn",\
"vats": [\
{\
"title": "не облагается",\
"slug": "ru_vat_none"}]},\
{\
"title": "Упрощенная УСН (Доход минус Расход)",\
"slug": "ru_usnr",\
"vats": [\
{\
"title": "не облагается",\
"slug": "ru_vat_none"}]},\
{\
"title": "Единый налог на вмененный доход ЕНВД",\
"slug": "ru_envd",\
"vats": [\
{\
"title": "не облагается",\
"slug": "ru_vat_none"}]},\
{\
"title": "Единый сельскохозяйственный налог ЕСН",\
"slug": "ru_esn",\
"vats": [\
{\
"title": "не облагается",\
"slug": "ru_vat_none"}]},\
{\
"title": "Патентная система налогообложения",\
"slug": "ru_psn",\
"vats": [\
{\
"title": "не облагается",\
"slug": "ru_vat_none"}]}],
"meta": {
"count": 6}}`

## [tag/Fiskalizaciya-chekov/operation/Пример запроса в случае ошибки](https://developers.yclients.com/ru/\#tag/Fiskalizaciya-chekov/operation/%D0%9F%D1%80%D0%B8%D0%BC%D0%B5%D1%80%20%D0%B7%D0%B0%D0%BF%D1%80%D0%BE%D1%81%D0%B0%20%D0%B2%20%D1%81%D0%BB%D1%83%D1%87%D0%B0%D0%B5%20%D0%BE%D1%88%D0%B8%D0%B1%D0%BA%D0%B8) Пример запроса в случае успешной фискализации или в случае ошибка

post/integration/kkm/callback/

https://api.yclients.com/api/v1/integration/kkm/callback/

##### Authorizations:

_bearer_

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>e.g. application/vnd.yclients.v2+json |
| Conetnt-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token |

##### Request Body schema: application/json

object

### Responses

**200**
OK

### Request samples

- Payload

Content type

application/json

Copy

`{ }`

# [tag/Otzyvy-i-chaevye](https://developers.yclients.com/ru/\#tag/Otzyvy-i-chaevye) Отзывы и чаевые

После визита клиенту отправляется ссылка на форму отзыва, где он может оценить качество оказанных услуг и оставить чаевые мастеру, если у него подключен кошелек

## [tag/Otzyvy-i-chaevye/paths/~1master_record_review~1{recordToken}/get](https://developers.yclients.com/ru/\#tag/Otzyvy-i-chaevye/paths/~1master_record_review~1{recordToken}/get) Получение статуса формы отзыва

get/master\_record\_review/{recordToken}

https://api.yclients.com/api/v1/master\_record\_review/{recordToken}

##### Authorizations:

_bearer_

##### path Parameters

|     |     |
| --- | --- |
| recordToken<br>required | string<br>Короткий токен записи |

### Responses

**200**
Возвращает данные для отображения формы отзыва и информацию о статусе отправки отзыва и чаевых

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"favicon_url": "https://www.yclients.com/favicon.png",
"is_review_submitted": false,
"page_title": "Оставить отзыв",
"master": {
"id": 58961,
"name": "Алексей Уваров",
"company_id": 28939,
"specialization": "Перманентный макияж,  Художественная татуировка",
"rating": 5,
"show_rating": 1,
"avatar": "https://www.yclients.com/uploads/masters/sm/20161014151227_5360.jpg",
"prepaid": "forbidden",
"position": {
"id": 2185,
"title": "Мастер ПМ"}},
"company": {
"id": 28939,
"title": "\"Eyes-n-Lips\" СПб",
"logo": "https://www.yclients.com/uploads/s_a6f66721046345a6226ac3040a57fb7d.jpg",
"address": "ул. Гороховая д. 45 Б"},
"tips": [ ],
"record": {
"id": 8219891,
"payed_cost": "2000",
"date": "2017-08-11T15:00:00+0000"},
"currency": {
"id": 1,
"iso": "RUB",
"name": "Russian Ruble",
"symbol": "₽",
"is_symbol_after_amount": true},
"agreement_links": {
"terms_of_use": "https://www.yclients.com/info/terms-of-use-review-tips",
"confidentiality_agreement": "https://www.yclients.com/info/confidential"},
"language": {
"id": 1,
"locale": "ru-RU",
"iso": "ru"}},
"meta": [ ]}`

## [tag/Otzyvy-i-chaevye/paths/~1master_record_review~1{recordToken}/post](https://developers.yclients.com/ru/\#tag/Otzyvy-i-chaevye/paths/~1master_record_review~1{recordToken}/post) Отправка формы отзыва

post/master\_record\_review/{recordToken}

https://api.yclients.com/api/v1/master\_record\_review/{recordToken}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| recordToken<br>required | string<br>Короткий токен записи |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| rating<br>required | integer<int32><br>Оценка, выставляемая за отзыв (кол-во звезд от 1 до 5) |
| text | string<br>Текст отзыва |
| tips\_amount | number<double><br>Сумма чаевых |
| redirect\_prefix | string<br>Префиксная часть url, на который будет выполнен редирект после возврата с формы оплаты |

### Responses

**200**
Отзыв оставлен успешно

### Request samples

- Payload

Content type

application/json

Copy

`{
"rating": 5,
"text": "Отличный мастер!",
"tips_amount": 22.5,
"redirect_prefix": "https://n1.yclients.com"}`

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"charge": {
"url": "https://url.to/payment/system"}},
"meta": [ ]}`

# [tag/Resursy](https://developers.yclients.com/ru/\#tag/Resursy) Ресурсы

Для управления ресурсами используются следующие методы

## [tag/Resursy/operation/Получение ресурсов в филиале](https://developers.yclients.com/ru/\#tag/Resursy/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B5%D0%BD%D0%B8%D0%B5%20%D1%80%D0%B5%D1%81%D1%83%D1%80%D1%81%D0%BE%D0%B2%20%D0%B2%20%D1%84%D0%B8%D0%BB%D0%B8%D0%B0%D0%BB%D0%B5) Получение ресурсов в филиале

get/resources/{company\_id}

https://api.yclients.com/api/v1/resources/{company\_id}

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Идентификатор компании |

##### query Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив с объектами данных |
| meta | object<br>Метаданные (содержит количество найденных ресурсов) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 70,\
"title": "Педикюрное кресло",\
"instances": [\
{\
"id": 181,\
"title": "Педикюрное кресло #1",\
"resource_id": 70}]},\
{\
"id": 464,\
"title": "Массажный кабинет",\
"instances": [\
{\
"id": 1094,\
"title": "Массажный кабинет 1 этаж",\
"resource_id": 464},\
{\
"id": 1162,\
"title": "Массажный кабинет 2 этаж",\
"resource_id": 464}]}],
"meta": {
"count": 2}}`

# [tag/Raschyot-zarplat](https://developers.yclients.com/ru/\#tag/Raschyot-zarplat) Расчёт зарплат

Описание методов для работы с расчётом зарплат.

## [tag/Raschyot-zarplat/operation/api.salary.payroll.calculation.staff.search](https://developers.yclients.com/ru/\#tag/Raschyot-zarplat/operation/api.salary.payroll.calculation.staff.search) Поиск начислений по сотруднику

get/company/{company\_id}/salary/payroll/staff/{staff\_id}/calculation/

https://api.yclients.com/api/v1/company/{company\_id}/salary/payroll/staff/{staff\_id}/calculation/

Метод позволяет владельцу получить список начислений зарплаты по сотруднику.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |
| staff\_id<br>required | number<br>Example:123<br>Идентификатор сотрудника филиала. |

##### query Parameters

|     |     |
| --- | --- |
| date\_from<br>required | string<br>Example:date\_from=2023-03-01<br>Дата начала периода. |
| date\_to<br>required | string<br>Example:date\_to=2023-03-31<br>Дата окончания периода. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | Array of objects (Взаиморасчёты) |
| meta | object (Объект дополнительной информации о запросе с кол-вом найденных результатов) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Response samples

- 200
- 401
- 403
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 123,\
"company_id": 456,\
"staff_id": 789,\
"amount": 1000,\
"status": "confirmed",\
"date_create": "2023-03-03",\
"date_from": "2023-03-01",\
"date_to": "2023-03-02",\
"comment": "Начисление за день"}],
"meta": {
"count": 1}}`

## [tag/Raschyot-zarplat/operation/api.salary.payroll.calculation.staff.read](https://developers.yclients.com/ru/\#tag/Raschyot-zarplat/operation/api.salary.payroll.calculation.staff.read) Получение данных о начислении по сотруднику

get/company/{company\_id}/salary/payroll/staff/{staff\_id}/calculation/{calculation\_id}

https://api.yclients.com/api/v1/company/{company\_id}/salary/payroll/staff/{staff\_id}/calculation/{calculation\_id}

Метод позволяет владельцу получить подробную информацию о конкретном начислении зарплаты.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |
| staff\_id<br>required | number<br>Example:123<br>Идентификатор сотрудника филиала. |
| calculation\_id<br>required | number<br>Example:789<br>Идентификатор начисления зарплаты. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object (Объект начисления заработной платы с подробной информацией) |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

### Response samples

- 200
- 401
- 403
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 123,
"company_id": 456,
"staff_id": 789,
"amount": 1000,
"status": "confirmed",
"date_create": "2023-03-03",
"date_from": "2023-03-01",
"date_to": "2023-03-02",
"comment": "Начисление за день",
"salary_items": [\
{\
"date": "2023-03-01",\
"time": "12:00",\
"item_id": 123,\
"item_type_slug": "record",\
"salary_sum": "10",\
"record_id": 123,\
"client_id": 456,\
"cost": "1000",\
"paid": {\
"money_sum": "900",\
"discount_sum": "30",\
"bonus_sum": "70",\
"certificate_sum": "0",\
"abonement_sum": "0",\
"deposit_sum": "0"},\
"salary_calculation_info": {\
"criteria_title": "Примененный критерий",\
"param_title": "Примененный параметр",\
"scheme_title": "Примененная схема"},\
"targets": [\
{\
"target_type_slug": "service",\
"target_id": 321,\
"title": "Стрижка",\
"cost": "1000",\
"net_cost": "500",\
"salary_sum": "10",\
"salary_promotion_sum": "1",\
"salary_calculation": {\
"type_slug": "percent",\
"value": 1.5,\
"description": "1.5% от стоимости"}}],\
"salary_discrepancy": {\
"reason": "updated_rule",\
"actual_sum": "15",\
"difference_sum": "5"}}],
"currency": {
"id": 1,
"iso": "RUB",
"name": "Russian Ruble",
"symbol": "₽",
"is_symbol_after_amount": true}},
"meta": [ ]}`

## [tag/Raschyot-zarplat/operation/api.salary.calculation.staff.salary_schemes_count](https://developers.yclients.com/ru/\#tag/Raschyot-zarplat/operation/api.salary.calculation.staff.salary_schemes_count) Получение количества схем расчёта зарплат у сотрудника

get/company/{company\_id}/salary/calculation/staff/{staff\_id}/salary\_schemes\_count/

https://api.yclients.com/api/v1/company/{company\_id}/salary/calculation/staff/{staff\_id}/salary\_schemes\_count/

Метод позволяет получить количество схем расчёта зарплат по сотруднику перед тем, как запрашивать данные о суммах.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |
| staff\_id<br>required | number<br>Example:123<br>Идентификатор сотрудника филиала. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object (Количество прикреплённых схем расчёта зарплат) |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

### Response samples

- 200
- 401
- 403
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"staff_id": 1112684,
"salary_schemes_count": 2},
"meta": [ ]}`

## [tag/Raschyot-zarplat/operation/api.salary.calculation.staff.search](https://developers.yclients.com/ru/\#tag/Raschyot-zarplat/operation/api.salary.calculation.staff.search) Получение взаиморасчётов с сотрудником

get/company/{company\_id}/salary/calculation/staff/{staff\_id}/

https://api.yclients.com/api/v1/company/{company\_id}/salary/calculation/staff/{staff\_id}/

Метод позволяет владельцу получить взаиморасчёты с сотрудником.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |
| staff\_id<br>required | number<br>Example:123<br>Идентификатор сотрудника филиала. |

##### query Parameters

|     |     |
| --- | --- |
| date\_from<br>required | string<br>Example:date\_from=2023-03-01<br>Дата начала периода. |
| date\_to<br>required | string<br>Example:date\_to=2023-03-31<br>Дата окончания периода. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object (Взаиморасчёты) <br>Взаиморасчёты. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Response samples

- 200
- 401
- 403
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"total_sum": {
"income": "0",
"expense": "0",
"balance": "240746.48"},
"currency": {
"symbol": "₽"}},
"meta": [ ]}`

## [tag/Raschyot-zarplat/operation/api.salary.calculation.staff.daily.search](https://developers.yclients.com/ru/\#tag/Raschyot-zarplat/operation/api.salary.calculation.staff.daily.search) Получение взаиморасчётов с сотрудником в разрезе по дате

get/company/{company\_id}/salary/calculation/staff/daily/{staff\_id}/

https://api.yclients.com/api/v1/company/{company\_id}/salary/calculation/staff/daily/{staff\_id}/

Метод позволяет владельцу получить взаиморасчёты с сотрудником с группировкой по дате.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |
| staff\_id<br>required | number<br>Example:123<br>Идентификатор сотрудника филиала. |

##### query Parameters

|     |     |
| --- | --- |
| date\_from<br>required | string<br>Example:date\_from=2023-03-01<br>Дата начала периода. |
| date\_to<br>required | string<br>Example:date\_to=2023-03-31<br>Дата окончания периода. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object (Взаиморасчёты с группировкой по дате) <br>Взаиморасчёты с группировкой по дате. |
| meta | object (Объект дополнительной информации о запросе с кол-вом найденных результатов) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Response samples

- 200
- 401
- 403
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"payroll_daily": [\
{\
"date": "2023-03-01",\
"payroll_sum": {\
"income": "0",\
"expense": "0",\
"balance": "240746.48"}}],
"currency": {
"symbol": "₽"}},
"meta": {
"count": 1}}`

## [tag/Raschyot-zarplat/operation/api.salary.period.staff.search](https://developers.yclients.com/ru/\#tag/Raschyot-zarplat/operation/api.salary.period.staff.search) Получение расчёта зарплаты за период по сотруднику

get/company/{company\_id}/salary/period/staff/{staff\_id}/

https://api.yclients.com/api/v1/company/{company\_id}/salary/period/staff/{staff\_id}/

Метод позволяет владельцу получить расчёт зарплаты за период по сотруднику.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |
| staff\_id<br>required | number<br>Example:123<br>Идентификатор сотрудника филиала. |

##### query Parameters

|     |     |
| --- | --- |
| date\_from<br>required | string<br>Example:date\_from=2023-03-01<br>Дата начала периода. |
| date\_to<br>required | string<br>Example:date\_to=2023-03-31<br>Дата окончания периода. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object (Взаиморасчёты) <br>Взаиморасчёты. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Response samples

- 200
- 401
- 403
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"working_days_count": 32,
"working_hours_count": 353,
"group_services_count": 3,
"services_count": 0,
"services_sum": "0",
"goods_sales_count": 0,
"goods_sales_sum": "0",
"total_sum": "0",
"salary": "70600",
"currency": {
"symbol": "₽"}},
"meta": [ ]}`

## [tag/Raschyot-zarplat/operation/api.salary.period.staff.daily.search](https://developers.yclients.com/ru/\#tag/Raschyot-zarplat/operation/api.salary.period.staff.daily.search) Получение расчёта зарплаты за период по сотруднику в разрезе по дате

get/company/{company\_id}/salary/period/staff/daily/{staff\_id}/

https://api.yclients.com/api/v1/company/{company\_id}/salary/period/staff/daily/{staff\_id}/

Метод позволяет владельцу получить расчёт зарплаты за период по сотруднику с группировкой по дате.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |
| staff\_id<br>required | number<br>Example:123<br>Идентификатор сотрудника филиала. |

##### query Parameters

|     |     |
| --- | --- |
| date\_from<br>required | string<br>Example:date\_from=2023-03-01<br>Дата начала периода. |
| date\_to<br>required | string<br>Example:date\_to=2023-03-31<br>Дата окончания периода. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object (Расчёт за период по конкретному сотруднику с группировкой по дате) <br>Получение расчёта за период по конкретному сотруднику с группировкой по дате. |
| meta | object (Объект дополнительной информации о запросе с кол-вом найденных результатов) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Response samples

- 200
- 401
- 403
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"period_calculation_daily": [\
{\
"date": "2023-03-01",\
"period_calculation": {\
"working_days_count": 32,\
"working_hours_count": 353,\
"group_services_count": 3,\
"services_count": 0,\
"services_sum": "0",\
"goods_sales_count": 0,\
"goods_sales_sum": "0",\
"total_sum": "0",\
"salary": "70600"}}],
"currency": {
"symbol": "₽"}},
"meta": {
"count": 1}}`

## [tag/Raschyot-zarplat/operation/api.salary.staff.calculation](https://developers.yclients.com/ru/\#tag/Raschyot-zarplat/operation/api.salary.staff.calculation) Получение собственных взаиморасчётов сотрудника с филиалом

get/company/{company\_id}/salary/staff/{staff\_id}/calculation/

https://api.yclients.com/api/v1/company/{company\_id}/salary/staff/{staff\_id}/calculation/

Метод позволяет получить собственные взаиморасчёты сотрудника с филиалом. В правах доступа пользователя должна быть указана галочка "Доступ к расчёту заработной платы только конкретного сотрудника".

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |
| staff\_id<br>required | number<br>Example:123<br>Идентификатор сотрудника филиала. |

##### query Parameters

|     |     |
| --- | --- |
| date\_from<br>required | string<br>Example:date\_from=2023-03-01<br>Дата начала периода. |
| date\_to<br>required | string<br>Example:date\_to=2023-03-31<br>Дата окончания периода. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object (Взаиморасчёты) <br>Взаиморасчёты. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Response samples

- 200
- 401
- 403
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"total_sum": {
"income": "0",
"expense": "0",
"balance": "240746.48"},
"currency": {
"symbol": "₽"}},
"meta": [ ]}`

## [tag/Raschyot-zarplat/operation/api.salary.staff.salary_schemes](https://developers.yclients.com/ru/\#tag/Raschyot-zarplat/operation/api.salary.staff.salary_schemes) Получение собственных схем расчёта зарплат

get/company/{company\_id}/salary/staff/{staff\_id}/salary\_schemes/

https://api.yclients.com/api/v1/company/{company\_id}/salary/staff/{staff\_id}/salary\_schemes/

Метод позволяет получить собственные схемы расчёта зарплат.
В правах доступа пользователя должна быть указана галочка "Доступ к расчёту заработной платы только конкретного сотрудника".

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |
| staff\_id<br>required | number<br>Example:123<br>Идентификатор сотрудника филиала. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | Array of objects (Объект схемы расчёта зарплаты) |
| meta | object (Объект дополнительной информации о запросе с кол-вом найденных результатов) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

### Response samples

- 200
- 401
- 403
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"staff_id": 1112684,\
"date_start": 1622505600,\
"date_end": 1630454400,\
"salary_scheme": {\
"id": 28681,\
"title": "Услуги 20%"}},\
{\
"staff_id": 1112684,\
"date_start": 1630454400,\
"salary_scheme": {\
"id": 28680,\
"title": "Услуги 30%"}}],
"meta": {
"count": 2}}`

## [tag/Raschyot-zarplat/operation/api.salary.staff.period](https://developers.yclients.com/ru/\#tag/Raschyot-zarplat/operation/api.salary.staff.period) Получение расчёта собственной зарплаты за период

get/company/{company\_id}/salary/staff/{staff\_id}/period/

https://api.yclients.com/api/v1/company/{company\_id}/salary/staff/{staff\_id}/period/

Метод позволяет получить расчёт собственной зарплаты за период.
В правах доступа пользователя должна быть указана галочка "Доступ к расчёту заработной платы только конкретного сотрудника".

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |
| staff\_id<br>required | number<br>Example:123<br>Идентификатор сотрудника филиала. |

##### query Parameters

|     |     |
| --- | --- |
| date\_from<br>required | string<br>Example:date\_from=2023-03-01<br>Дата начала периода. |
| date\_to<br>required | string<br>Example:date\_to=2023-03-31<br>Дата окончания периода. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object (Расчёт за период по конкретному сотруднику) <br>Получение расчёта за период по конкретному сотруднику. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Response samples

- 200
- 401
- 403
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"working_days_count": 32,
"working_hours_count": 353,
"group_services_count": 3,
"services_count": 0,
"services_sum": "0",
"goods_sales_count": 0,
"goods_sales_sum": "0",
"total_sum": "0",
"salary": "70600",
"currency": {
"symbol": "₽"}},
"meta": [ ]}`

# [tag/Uvedomleniya](https://developers.yclients.com/ru/\#tag/Uvedomleniya) Уведомления

В этом разделе расположены методы для получения и изменения настроек уведомлений.

Объекты имееют следующие поля:

| Поле | Тип | Описание |
| --- | --- | --- |
| mode | string | Тип уведомления, выбранный у пользователя ("admin", "staff", "disabled") |
| record\_create\_online\_staff | string | Уведомление сотруднику об онлайн-записи |
| record\_create\_offline\_staff | string | Уведомление сотруднику об офлайн-записи |
| record\_delete\_staff | string | Уведомление сотруднику об удалении записи через Интернет |
| record\_move\_staff | string | Уведомление сотруднику о переносе записи через Интернет |
| record\_create\_online\_admin | string | Уведомление администратору об онлайн-записи |
| record\_create\_offline\_admin | string | Уведомление администратору об офлайн-записи |
| record\_delete\_admin | string | Уведомление администратору об удалении записи через Интернет |
| record\_move\_admin | string | Уведомление администратору о переносе записи через Интернет |
| license\_expire | string | Уведомление сотруднику/администратору об окончании лицензии |

## [tag/Uvedomleniya/paths/~1notification_settings~1{company_id}~1notification_types/get](https://developers.yclients.com/ru/\#tag/Uvedomleniya/paths/~1notification_settings~1{company_id}~1notification_types/get) Получить настройки уведомлений в филиале

get/notification\_settings/{company\_id}/notification\_types

https://api.yclients.com/api/v1/notification\_settings/{company\_id}/notification\_types

Метод позволяет получить настройки уведомлений в филиале.

##### Authorizations:

(_user__bearer_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Идентификатор компании |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer bearer\_token, USer user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения |
| data | Array of objects<br>Массив объектов |
| meta | object<br>Метаданные (содержит количество объектов) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"type": "record_create_online_staff",\
"channels": {\
"push": 1,\
"sms": 0,\
"email": 1}},\
{\
"type": "record_move_admin",\
"channels": {\
"push": 1,\
"sms": 0,\
"email": 0}},\
{\
"type": "license_expire",\
"channels": {\
"push": 1,\
"sms": 1,\
"email": 1}},\
{\
"type": "record_create_offline_admin",\
"channels": {\
"push": 1,\
"sms": 0,\
"email": 1}},\
{\
"type": "record_create_offline_staff",\
"channels": {\
"push": 1,\
"sms": 0,\
"email": 0}},\
{\
"type": "record_create_online_admin",\
"channels": {\
"push": 1,\
"sms": 0,\
"email": 1}},\
{\
"type": "record_delete_admin",\
"channels": {\
"push": 0,\
"sms": 0,\
"email": 1}},\
{\
"type": "record_delete_staff",\
"channels": {\
"push": 1,\
"sms": 0,\
"email": 0}},\
{\
"type": "record_move_staff",\
"channels": {\
"push": 0,\
"sms": 0,\
"email": 0}}],
"meta": {
"count": 9}}`

## [tag/Uvedomleniya/paths/~1notification_settings~1{company_id}~1users~1{user_id}/get](https://developers.yclients.com/ru/\#tag/Uvedomleniya/paths/~1notification_settings~1{company_id}~1users~1{user_id}/get) Получить настройки уведомлений пользователя

get/notification\_settings/{company\_id}/users/{user\_id}

https://api.yclients.com/api/v1/notification\_settings/{company\_id}/users/{user\_id}

Метод позволяет получить настройки уведомлений конкретного пользователя филиала.

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Идентификатор компании |
| user\_id<br>required | number<br>Идентификатор пользователя |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer bearer\_token, User user\_token |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"mode": "staff",
"notification_types": [\
{\
"type": "record_create_online_staff",\
"channels": {\
"push": 1,\
"sms": 0,\
"email": 1}},\
{\
"type": "record_create_offline_staff",\
"channels": {\
"push": 1,\
"sms": 0,\
"email": 0}},\
{\
"type": "record_delete_staff",\
"channels": {\
"push": 0,\
"sms": 0,\
"email": 0}},\
{\
"type": "record_move_staff",\
"channels": {\
"push": 0,\
"sms": 0,\
"email": 0}},\
{\
"type": "license_expire",\
"channels": {\
"push": 0,\
"sms": 0,\
"email": 0}}]},
"meta": [ ]}`

## [tag/Uvedomleniya/paths/~1notification_settings~1{company_id}~1users~1{user_id}/post](https://developers.yclients.com/ru/\#tag/Uvedomleniya/paths/~1notification_settings~1{company_id}~1users~1{user_id}/post) Изменить настройки PUSH-уведомлений пользователя

post/notification\_settings/{company\_id}/users/{user\_id}

https://api.yclients.com/api/v1/notification\_settings/{company\_id}/users/{user\_id}

Метод позволяет изменить настройки PUSH-уведомлений пользователя.
Выбирать тип уведомления для изменения (record\_create\_online\_staff или record\_create\_online\_admin и т.д.) следует исходя их указанного типа уведомления у пользователя (mode: admin или mode: staff)

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Идентификатор компании |
| user\_id<br>required | number<br>Идентификатор пользователя |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer bearer\_token, User user\_token |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| notification\_types | Array of objects<br>Массив объектов |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения |
| data | object<br>Объект с данными |
| meta | Array of objects<br>Метаданные (пустой массив) |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"notification_types": [\
{\
"type": "record_create_online_admin",\
"channels": {\
"push": 1}},\
{\
"type": "record_create_offline_admin",\
"channels": {\
"push": 1}},\
{\
"type": "record_delete_admin",\
"channels": {\
"push": 1}},\
{\
"type": "record_move_admin",\
"channels": {\
"push": 1}},\
{\
"type": "license_expire",\
"channels": {\
"push": 1}}]}`

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"mode": "staff",
"notification_types": [\
{\
"type": "record_create_online_staff",\
"channels": {\
"push": 1,\
"sms": 0,\
"email": 0}},\
{\
"type": "record_create_offline_staff",\
"channels": {\
"push": 0,\
"sms": 0,\
"email": 0}},\
{\
"type": "record_delete_staff",\
"channels": {\
"push": 0,\
"sms": 0,\
"email": 0}},\
{\
"type": "record_move_staff",\
"channels": {\
"push": 0,\
"sms": 0,\
"email": 0}},\
{\
"type": "license_expire",\
"channels": {\
"push": 0,\
"sms": 0,\
"email": 0}}]},
"meta": [ ]}`

# [tag/Nastrojki-onlajn-zapisi](https://developers.yclients.com/ru/\#tag/Nastrojki-onlajn-zapisi) Настройки онлайн-записи

## [tag/Nastrojki-onlajn-zapisi/operation/Получение настроек онлайн-записи](https://developers.yclients.com/ru/\#tag/Nastrojki-onlajn-zapisi/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B5%D0%BD%D0%B8%D0%B5%20%D0%BD%D0%B0%D1%81%D1%82%D1%80%D0%BE%D0%B5%D0%BA%20%D0%BE%D0%BD%D0%BB%D0%B0%D0%B9%D0%BD-%D0%B7%D0%B0%D0%BF%D0%B8%D1%81%D0%B8) Получение настроек онлайн-записи

get/company/{company\_id}/settings/online

https://api.yclients.com/api/v1/company/{company\_id}/settings/online

##### Authorizations:

(_bearer__user_)

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>e.g. application/vnd.yclients.v2+json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |
| Content-Type<br>required | string<br>application/json |

### Responses

**200**
Данные настроек онлайн-записи

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object (Root Type for company\_get\_online\_settings\_response\_data\_field\_data\_types) |
| meta | Array of objects<br>Метаданные |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"confirm_number": false,
"any_master": true,
"seance_delay_step": 90,
"activity_online_record_clients_count_max": 1},
"meta": [ ]}`

## [tag/Nastrojki-onlajn-zapisi/operation/Обновление настроек онлайн-записи](https://developers.yclients.com/ru/\#tag/Nastrojki-onlajn-zapisi/operation/%D0%9E%D0%B1%D0%BD%D0%BE%D0%B2%D0%BB%D0%B5%D0%BD%D0%B8%D0%B5%20%D0%BD%D0%B0%D1%81%D1%82%D1%80%D0%BE%D0%B5%D0%BA%20%D0%BE%D0%BD%D0%BB%D0%B0%D0%B9%D0%BD-%D0%B7%D0%B0%D0%BF%D0%B8%D1%81%D0%B8) Обновление настроек онлайн-записи

patch/company/{company\_id}/settings/online

https://api.yclients.com/api/v1/company/{company\_id}/settings/online

##### Authorizations:

(_bearer__user_)

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>e.g. application/vnd.yclients.v2+json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |
| Content-Type<br>required | string<br>application/json |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| confirm\_number<br>required | boolean<br>Подтверждать номер клиента по SMS |
| any\_master<br>required | boolean<br>Режим "Любой сотрудник" |
| seance\_delay\_step<br>required | integer\[ 0 .. 1380 \]<br>Задержка до ближайшего сеанса, в минутах от 0 до 23 часов (включительно) с шагом 30 минут |
| activity\_online\_record\_clients\_count\_max<br>required | integer\[ 1 .. 255 \]<br>Максимальное количество мест в одной записи события |

### Responses

**200**
Обновленные данные настроек онлайн-записи

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object (Root Type for company\_get\_online\_settings\_response\_data\_field\_data\_types) |
| meta | Array of objects<br>Метаданные |

### Request samples

- Payload

Content type

application/json

Copy

`{
"confirm_number": false,
"any_master": true,
"seance_delay_step": 90,
"activity_online_record_clients_count_max": 1}`

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"confirm_number": false,
"any_master": true,
"seance_delay_step": 90,
"activity_online_record_clients_count_max": 1},
"meta": [ ]}`

# [tag/Nastrojki-zhurnala-zapisi](https://developers.yclients.com/ru/\#tag/Nastrojki-zhurnala-zapisi) Настройки журнала записи

## [tag/Nastrojki-zhurnala-zapisi/operation/Получение настроек журнала записи](https://developers.yclients.com/ru/\#tag/Nastrojki-zhurnala-zapisi/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B5%D0%BD%D0%B8%D0%B5%20%D0%BD%D0%B0%D1%81%D1%82%D1%80%D0%BE%D0%B5%D0%BA%20%D0%B6%D1%83%D1%80%D0%BD%D0%B0%D0%BB%D0%B0%20%D0%B7%D0%B0%D0%BF%D0%B8%D1%81%D0%B8) Получение настроек журнала записи

get/company/{company\_id}/settings/timetable

https://api.yclients.com/api/v1/company/{company\_id}/settings/timetable

##### Authorizations:

(_bearer__user_)

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>e.g. application/vnd.yclients.v2+json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |
| Content-Type<br>required | string<br>application/json |

### Responses

**200**
Данные настроек журнала записи

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object (Root Type for company\_get\_timetable\_settings\_response\_data\_field\_data\_types) |
| meta | Array of objects<br>Метаданные |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"record_type": 0,
"activity_record_clients_count_max": 1},
"meta": [ ]}`

## [tag/Nastrojki-zhurnala-zapisi/operation/Обновление настроек журнала записи](https://developers.yclients.com/ru/\#tag/Nastrojki-zhurnala-zapisi/operation/%D0%9E%D0%B1%D0%BD%D0%BE%D0%B2%D0%BB%D0%B5%D0%BD%D0%B8%D0%B5%20%D0%BD%D0%B0%D1%81%D1%82%D1%80%D0%BE%D0%B5%D0%BA%20%D0%B6%D1%83%D1%80%D0%BD%D0%B0%D0%BB%D0%B0%20%D0%B7%D0%B0%D0%BF%D0%B8%D1%81%D0%B8) Обновление настроек журнала записи

patch/company/{company\_id}/settings/timetable

https://api.yclients.com/api/v1/company/{company\_id}/settings/timetable

##### Authorizations:

(_bearer__user_)

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>e.g. application/vnd.yclients.v2+json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |
| Content-Type<br>required | string<br>application/json |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| record\_type<br>required | integer\[ 0 .. 2 \]<br>Тип записи по умолчанию: 0 - Смешанная запись, 1 - Индивидуальная запись, 2 - Групповая запись |
| activity\_record\_clients\_count\_max<br>required | integer\[ 1 .. 255 \]<br>Максимальное количество мест в одной записи события |

### Responses

**200**
Обновленные данные настроек журнала записи

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | object (Root Type for company\_get\_timetable\_settings\_response\_data\_field\_data\_types) |
| meta | Array of objects<br>Метаданные |

### Request samples

- Payload

Content type

application/json

Copy

`{
"record_type": 0,
"activity_record_clients_count_max": 1}`

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"record_type": 90,
"activity_record_clients_count_max": 1},
"meta": [ ]}`

# [tag/Nastrojki-bukformy](https://developers.yclients.com/ru/\#tag/Nastrojki-bukformy) Настройки букформы

## [tag/Nastrojki-bukformy/operation/Получить список букформ](https://developers.yclients.com/ru/\#tag/Nastrojki-bukformy/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D1%81%D0%BF%D0%B8%D1%81%D0%BE%D0%BA%20%D0%B1%D1%83%D0%BA%D1%84%D0%BE%D1%80%D0%BC) Получить список букформ

get/company/{company\_id}/booking\_forms/

https://api.yclients.com/api/v1/company/{company\_id}/booking\_forms/

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>e.g. application/vnd.yclients.v2+json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |
| Content-Type<br>required | string<br>application/json |

### Responses

**200**
Список букформ

##### Response Schema: application/json

|     |     |
| --- | --- |
| data<br>required | Array of objects (Root Type BookformSettingsResponse) <br>Array of data |
| meta<br>required | Array of objects<br>Metadata (contains the total count of bookforms) |
| success<br>required | boolean<br>Success status (true) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 1,\
"title": "Название",\
"is_default": false,\
"description": "Описание",\
"without_menu": false,\
"service_step_default": 0,\
"service_step_hide": false,\
"master_step_default": 0,\
"master_step_hide": false,\
"service_step_num": 2,\
"master_step_num": 1,\
"datetime_step_num": 3,\
"show_button": true,\
"button_position": "bottom right",\
"form_position": "right",\
"button_color": "#1c84c6",\
"button_animation": true,\
"html_code": "",\
"ab_test_enabled": false}],
"meta": [ ]}`

## [tag/Nastrojki-bukformy/operation/Создать букформу](https://developers.yclients.com/ru/\#tag/Nastrojki-bukformy/operation/%D0%A1%D0%BE%D0%B7%D0%B4%D0%B0%D1%82%D1%8C%20%D0%B1%D1%83%D0%BA%D1%84%D0%BE%D1%80%D0%BC%D1%83) Создать букформу

post/company/{company\_id}/booking\_forms/

https://api.yclients.com/api/v1/company/{company\_id}/booking\_forms/

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>e.g. application/vnd.yclients.v2+json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |
| Content-Type<br>required | string<br>application/json |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| title<br>required | string<br>Название букформы |
| description | string<br>Default:""<br>Описание букформы |
| is\_default | boolean<br>Default:false<br>Флаг дефолтной букформы |
| without\_menu | boolean<br>Default:false<br>Флаг пошагового режима |
| service\_step\_default | number<br>ID услуги |
| service\_step\_hide | boolean<br>Default:false<br>Флаг скрытия услуги |
| master\_step\_default | number<br>ID мастера |
| master\_step\_hide | boolean<br>Default:false<br>Флаг скрытия мастера |
| service\_step\_num | number<br>Порядковый номер шага услуги |
| master\_step\_num | number<br>Порядковый номер шага мастера |
| datetime\_step\_num | number<br>Порядковый номер шага даты и времени |
| show\_button | boolean<br>Default:true<br>Флаг включения видимости кнопки |
| button\_position | string<br>Default:"bottom right"<br>Enum:"bottom right""bottom left""top right""top left "<br>Расположение кнопки на странице |
| form\_position | string<br>Default:"right"<br>Enum:"right""left"<br>Расположение панели на странице |
| button\_color | string<br>Default:"#1c84c6"<br>Цвет кнопки |
| button\_animation | boolean<br>Default:true<br>Флаг включения анимации кнопки |

### Responses

**201**
Настройки букформы

##### Response Schema: application/json

|     |     |
| --- | --- |
| data<br>required | object (Root Type BookformSettingsResponse) <br>Настройки букформы |
| meta<br>required | Array of objects<br>Metadata |
| success<br>required | boolean<br>Success status (true) |

### Request samples

- Payload

Content type

application/json

Copy

`{
"title": "string",
"description": "",
"is_default": false,
"without_menu": false,
"service_step_default": 0,
"service_step_hide": false,
"master_step_default": 0,
"master_step_hide": false,
"service_step_num": 0,
"master_step_num": 0,
"datetime_step_num": 0,
"show_button": true,
"button_position": "bottom right",
"form_position": "right",
"button_color": "#1c84c6",
"button_animation": true}`

### Response samples

- 201

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 1,
"title": "Название",
"is_default": false,
"description": "Описание",
"without_menu": false,
"service_step_default": 0,
"service_step_hide": false,
"master_step_default": 0,
"master_step_hide": false,
"service_step_num": 2,
"master_step_num": 1,
"datetime_step_num": 3,
"show_button": true,
"button_position": "bottom right",
"form_position": "right",
"button_color": "#1c84c6",
"button_animation": true,
"html_code": "",
"ab_test_enabled": false},
"meta": [ ]}`

## [tag/Nastrojki-bukformy/operation/Получить букформу](https://developers.yclients.com/ru/\#tag/Nastrojki-bukformy/operation/%D0%9F%D0%BE%D0%BB%D1%83%D1%87%D0%B8%D1%82%D1%8C%20%D0%B1%D1%83%D0%BA%D1%84%D0%BE%D1%80%D0%BC%D1%83) Получить букформу

get/company/{company\_id}/booking\_forms/{form\_id}/

https://api.yclients.com/api/v1/company/{company\_id}/booking\_forms/{form\_id}/

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| form\_id<br>required | number<br>ID букформы |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>e.g. application/vnd.yclients.v2+json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |
| Content-Type<br>required | string<br>application/json |

### Responses

**200**
Настройки букформы

##### Response Schema: application/json

|     |     |
| --- | --- |
| data<br>required | object (Root Type BookformSettingsResponse) <br>Настройки букформы |
| meta<br>required | Array of objects<br>Metadata |
| success<br>required | boolean<br>Success status (true) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 1,
"title": "Название",
"is_default": false,
"description": "Описание",
"without_menu": false,
"service_step_default": 0,
"service_step_hide": false,
"master_step_default": 0,
"master_step_hide": false,
"service_step_num": 2,
"master_step_num": 1,
"datetime_step_num": 3,
"show_button": true,
"button_position": "bottom right",
"form_position": "right",
"button_color": "#1c84c6",
"button_animation": true,
"html_code": "",
"ab_test_enabled": false},
"meta": [ ]}`

## [tag/Nastrojki-bukformy/operation/Удалить букформу](https://developers.yclients.com/ru/\#tag/Nastrojki-bukformy/operation/%D0%A3%D0%B4%D0%B0%D0%BB%D0%B8%D1%82%D1%8C%20%D0%B1%D1%83%D0%BA%D1%84%D0%BE%D1%80%D0%BC%D1%83) Удалить букформу

delete/company/{company\_id}/booking\_forms/{form\_id}/

https://api.yclients.com/api/v1/company/{company\_id}/booking\_forms/{form\_id}/

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| form\_id<br>required | number<br>ID букформы |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>e.g. application/vnd.yclients.v2+json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |
| Content-Type<br>required | string<br>application/json |

### Responses

**204**
No Content

## [tag/Nastrojki-bukformy/operation/Изменить букформу](https://developers.yclients.com/ru/\#tag/Nastrojki-bukformy/operation/%D0%98%D0%B7%D0%BC%D0%B5%D0%BD%D0%B8%D1%82%D1%8C%20%D0%B1%D1%83%D0%BA%D1%84%D0%BE%D1%80%D0%BC%D1%83) Изменить букформу

patch/company/{company\_id}/booking\_forms/{form\_id}/

https://api.yclients.com/api/v1/company/{company\_id}/booking\_forms/{form\_id}/

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>ID компании |
| form\_id<br>required | number<br>ID букформы |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>e.g. application/vnd.yclients.v2+json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |
| Content-Type<br>required | string<br>application/json |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| title<br>required | string<br>Название букформы |
| description<br>required | string<br>Описание букформы |
| is\_default<br>required | boolean<br>Флаг дефолтной букформы |
| without\_menu<br>required | boolean<br>Флаг пошагового режима |
| service\_step\_default<br>required | number<br>ID услуги |
| service\_step\_hide<br>required | boolean<br>Флаг скрытия услуги |
| master\_step\_default<br>required | number<br>ID мастера |
| master\_step\_hide<br>required | boolean<br>Флаг скрытия мастера |
| service\_step\_num<br>required | number<br>Порядковый номер шага услуги |
| master\_step\_num<br>required | number<br>Порядковый номер шага мастера |
| datetime\_step\_num<br>required | number<br>Порядковый номер шага даты и времени |
| show\_button<br>required | boolean<br>Шаг включения видимости кнопки |
| button\_position<br>required | string<br>Enum:"bottom right""bottom left""top right""top left"<br>Расположение кнопки на странице |
| form\_position<br>required | string<br>Enum:"right""left"<br>Расположение панели на странице |
| button\_color<br>required | string<br>Цвет кнопки |
| button\_animation<br>required | boolean<br>Флаг включения анимации кнопки |

### Responses

**200**
Настройки букформы

##### Response Schema: application/json

|     |     |
| --- | --- |
| data<br>required | object (Root Type BookformSettingsResponse) <br>Настройки букформы |
| meta<br>required | Array of objects<br>Metadata |
| success<br>required | boolean<br>Success status (true) |

### Request samples

- Payload

Content type

application/json

Copy

`{
"title": "string",
"description": "string",
"is_default": true,
"without_menu": true,
"service_step_default": 0,
"service_step_hide": true,
"master_step_default": 0,
"master_step_hide": true,
"service_step_num": 0,
"master_step_num": 0,
"datetime_step_num": 0,
"show_button": true,
"button_position": "bottom right",
"form_position": "right",
"button_color": "string",
"button_animation": true}`

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 1,
"title": "Название",
"is_default": false,
"description": "Описание",
"without_menu": false,
"service_step_default": 0,
"service_step_hide": false,
"master_step_default": 0,
"master_step_hide": false,
"service_step_num": 2,
"master_step_num": 1,
"datetime_step_num": 3,
"show_button": true,
"button_position": "bottom right",
"form_position": "right",
"button_color": "#1c84c6",
"button_animation": true,
"html_code": "",
"ab_test_enabled": false},
"meta": [ ]}`

# [tag/Raspisaniya-zapisejsobytij](https://developers.yclients.com/ru/\#tag/Raspisaniya-zapisejsobytij) Расписания записей/событий

С помощью расписания можно удобно настроить повторения индивидуальных записей (пока не поддерживается) или групповых событий.
В рамках расписания можно настроить несколько серий по одному конкретно взятому дню недели, и настроить параметры этих серий под определенные нужды.
В рамках разных серий расписания можно настроить разных сотрудников, оказывающих услуги, разные категории и ресурсы для этих сущностей и прочее.

## [tag/Raspisaniya-zapisejsobytij/operation/api.location.timetable_event_schedules.search_by_event](https://developers.yclients.com/ru/\#tag/Raspisaniya-zapisejsobytij/operation/api.location.timetable_event_schedules.search_by_event) Поиск расписания по сущности

get/company/{company\_id}/schedules/search/{entity\_type}/{entity\_id}

https://api.yclients.com/api/v1/company/{company\_id}/schedules/search/{entity\_type}/{entity\_id}

Осуществляет поиск расписания по записи или событию, принадлежащему расписанию или на основе которого расписание было построено.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |
| entity\_type<br>required | string<br>Enum:"record""activity"<br>Example:activity<br>Тип сущности, для которой осуществляется поиск расписания:<br>`record` \- индивидуальная запись, не поддерживается в текущий момент;<br>`activity` \- групповое событие. |
| entity\_id<br>required | number<br>Example:123<br>Идентификатор сущности, для которой осуществляется поиск расписания. |

##### query Parameters

|     |     |
| --- | --- |
| include | Array of strings<br>ItemsEnum:"days""days.events\_master""days.events\_labels""days.events\_resource\_instances"<br>Набор сущностей, которые должны быть включены в ответ. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object (Объект модели "Расписание") <br>Данные по существующему в филиале расписанию записей или событий. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

### Response samples

- 200
- 401
- 403
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 123,
"created_at": "2022-01-01 12:12:12",
"updated_at": "2022-01-01 12:12:12",
"deleted_at": null,
"original_entity_type": "activity",
"original_entity_id": 123,
"date_start": "2022-01-01",
"date_end": "2022-02-01",
"days": [\
{\
"id": 123,\
"created_at": "2022-01-01 12:12:12",\
"updated_at": "2022-01-01 12:12:12",\
"deleted_at": null,\
"timetable_event_schedule_id": 123,\
"day_of_week": "mon",\
"events_time": "14:00:00",\
"events_duration": 3600,\
"events_master": {\
"id": 123,\
"name": "Иван Иванов",\
"company_id": 123,\
"specialization": "Мастер",\
"avatar": "https://yclients.com/images/no-master-sm.png",\
"avatar_big": "https://yclients.com/images/no-master.png",\
"position": {\
"id": 123,\
"title": "Сотрудник"}},\
"events_labels": [\
{\
"id": 123,\
"title": "Категория",\
"color": "#ff0000"}],\
"events_resource_instances": [\
{\
"id": 123,\
"title": "Ресурс #1",\
"resource_id": 123}]}]},
"meta": { }}`

## [tag/Raspisaniya-zapisejsobytij/operation/api.location.timetable_event_schedules.create](https://developers.yclients.com/ru/\#tag/Raspisaniya-zapisejsobytij/operation/api.location.timetable_event_schedules.create) Создание расписания

post/company/{company\_id}/schedules

https://api.yclients.com/api/v1/company/{company\_id}/schedules

Создает расписание записей или событий, основываясь на исходной записи или событии.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |

##### query Parameters

|     |     |
| --- | --- |
| include | Array of strings<br>ItemsValue:"days"<br>Набор сущностей, которые должны быть включены в ответ. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| original\_entity\_type<br>required | string<br>Enum:"record""activity"<br>Тип сущности, на основе которой будет построено расписание:<br>`record` \- индивидуальная запись, не поддерживается в текущий момент;<br>`activity` \- групповое событие. |
| original\_entity\_id<br>required | number<br>Идентификатор сущности, на основе которой будет построено расписание. |
| date\_end<br>required | string<date><br>Дата окончания расписания. |
| days<br>required | Array of objects\[ 1 .. 7 \] items<br>Настройки серий расписания, минимально 1 серия, максимально 7 серий (серия соответствует дню недели). |

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object (Объект модели "Расписание") <br>Данные по существующему в филиале расписанию записей или событий. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"original_entity_type": "activity",
"original_entity_id": 123,
"date_end": "2022-02-01",
"days": [\
{\
"day_of_week": "mon",\
"events_master_id": 123,\
"events_time": "14:00:00",\
"events_duration": 3600,\
"events_capacity": 4,\
"labels_ids": [\
123],\
"resource_instances_ids": [\
123]}]}`

### Response samples

- 201
- 401
- 403
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 123,
"created_at": "2022-01-01 12:12:12",
"updated_at": "2022-01-01 12:12:12",
"deleted_at": null,
"original_entity_type": "activity",
"original_entity_id": 123,
"date_start": "2022-01-01",
"date_end": "2022-02-01",
"days": [\
{\
"id": 123,\
"created_at": "2022-01-01 12:12:12",\
"updated_at": "2022-01-01 12:12:12",\
"deleted_at": null,\
"timetable_event_schedule_id": 123,\
"day_of_week": "mon",\
"events_time": "14:00:00",\
"events_duration": 3600,\
"events_master": {\
"id": 123,\
"name": "Иван Иванов",\
"company_id": 123,\
"specialization": "Мастер",\
"avatar": "https://yclients.com/images/no-master-sm.png",\
"avatar_big": "https://yclients.com/images/no-master.png",\
"position": {\
"id": 123,\
"title": "Сотрудник"}},\
"events_labels": [\
{\
"id": 123,\
"title": "Категория",\
"color": "#ff0000"}],\
"events_resource_instances": [\
{\
"id": 123,\
"title": "Ресурс #1",\
"resource_id": 123}]}]},
"meta": { }}`

## [tag/Raspisaniya-zapisejsobytij/operation/api.location.timetable_event_schedules.update](https://developers.yclients.com/ru/\#tag/Raspisaniya-zapisejsobytij/operation/api.location.timetable_event_schedules.update) Обновление расписания

patch/company/{company\_id}/schedules/{schedule\_id}

https://api.yclients.com/api/v1/company/{company\_id}/schedules/{schedule\_id}

Обновляет настройки расписания записей или событий.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |
| schedule\_id<br>required | number<br>Example:123<br>Идентификатор расписания. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| date\_end | string<date><br>Дата окончания расписания. |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object (Объект модели "Расписание") <br>Данные по существующему в филиале расписанию записей или событий. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Request samples

- Payload

Content type

application/json

Copy

`{
"date_end": "2022-02-01"}`

### Response samples

- 200
- 401
- 403
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 123,
"created_at": "2022-01-01 12:12:12",
"updated_at": "2022-01-01 12:12:12",
"deleted_at": null,
"original_entity_type": "activity",
"original_entity_id": 123,
"date_start": "2022-01-01",
"date_end": "2022-02-01",
"days": [\
{\
"id": 123,\
"created_at": "2022-01-01 12:12:12",\
"updated_at": "2022-01-01 12:12:12",\
"deleted_at": null,\
"timetable_event_schedule_id": 123,\
"day_of_week": "mon",\
"events_time": "14:00:00",\
"events_duration": 3600,\
"events_master": {\
"id": 123,\
"name": "Иван Иванов",\
"company_id": 123,\
"specialization": "Мастер",\
"avatar": "https://yclients.com/images/no-master-sm.png",\
"avatar_big": "https://yclients.com/images/no-master.png",\
"position": {\
"id": 123,\
"title": "Сотрудник"}},\
"events_labels": [\
{\
"id": 123,\
"title": "Категория",\
"color": "#ff0000"}],\
"events_resource_instances": [\
{\
"id": 123,\
"title": "Ресурс #1",\
"resource_id": 123}]}]},
"meta": { }}`

## [tag/Raspisaniya-zapisejsobytij/operation/api.location.timetable_event_schedules.delete](https://developers.yclients.com/ru/\#tag/Raspisaniya-zapisejsobytij/operation/api.location.timetable_event_schedules.delete) Удаление расписания

delete/company/{company\_id}/schedules/{schedule\_id}

https://api.yclients.com/api/v1/company/{company\_id}/schedules/{schedule\_id}

Полностью удаляет расписание и все записи или события, привязанные к нему.

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |
| schedule\_id<br>required | number<br>Example:123<br>Идентификатор расписания. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

### Responses

**204**
No Content

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

### Response samples

- 204
- 401
- 403
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": null,
"meta": { }}`

## [tag/Raspisaniya-zapisejsobytij/operation/api.location.timetable_event_schedules.days.create](https://developers.yclients.com/ru/\#tag/Raspisaniya-zapisejsobytij/operation/api.location.timetable_event_schedules.days.create) Создание серии расписания

post/company/{company\_id}/schedules/{schedule\_id}/days

https://api.yclients.com/api/v1/company/{company\_id}/schedules/{schedule\_id}/days

Добавляет к существующему расписанию записей или событий новую серию.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |
| schedule\_id<br>required | number<br>Example:123<br>Идентификатор расписания. |

##### query Parameters

|     |     |
| --- | --- |
| include | Array of strings<br>ItemsEnum:"events\_master""events\_labels""events\_resource\_instances""events"<br>Набор сущностей, которые должны быть включены в ответ. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| day\_of\_week<br>required | string<br>Enum:"mon""tue""wed""thu""fri""sat""sun"<br>День недели серии расписания. |
| events\_master\_id<br>required | number<br>Идентификатор сотрудника, оказывающего услуги в рамках серии расписания. |
| events\_time<br>required | string<br>Время начала записей или событий в рамках серии расписания (в формате HH:MM:SS). |
| events\_duration<br>required | number<br>Длительность записей или событий в рамках серии расписания (в секундах). |
| events\_capacity<br>required | number<br>Вместимость событий в рамках серии расписания (для записей значение должно быть равно 1). |
| labels\_ids | Array of numbers<br>Идентификаторы категорий, привязанных к записям или событиям в рамках серии расписания. |
| resource\_instances\_ids | Array of numbers<br>Идентификаторы экземпляров ресурсов, привязанных к записям или событиям в рамках серии расписания. |

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object (Объект модели "Серия Расписания") <br>Данные по существующей в филиале серии расписания. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"day_of_week": "mon",
"events_master_id": 123,
"events_time": "14:00:00",
"events_duration": 3600,
"events_capacity": 4,
"labels_ids": [\
123],
"resource_instances_ids": [\
123]}`

### Response samples

- 201
- 401
- 403
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 123,
"created_at": "2022-01-01 12:12:12",
"updated_at": "2022-01-01 12:12:12",
"deleted_at": null,
"timetable_event_schedule_id": 123,
"day_of_week": "mon",
"events_time": "14:00:00",
"events_duration": 3600,
"events_master": {
"id": 123,
"name": "Иван Иванов",
"company_id": 123,
"specialization": "Мастер",
"avatar": "https://yclients.com/images/no-master-sm.png",
"avatar_big": "https://yclients.com/images/no-master.png",
"position": {
"id": 123,
"title": "Сотрудник"}},
"events_labels": [\
{\
"id": 123,\
"title": "Категория",\
"color": "#ff0000"}],
"events_resource_instances": [\
{\
"id": 123,\
"title": "Ресурс #1",\
"resource_id": 123}],
"events": [\
{\
"id": 123,\
"created_at": "2022-01-01 12:12:12",\
"updated_at": "2022-01-01 12:12:12",\
"deleted_at": null,\
"event_status": "stable",\
"event_datetime": "2022-01-24 14:00:00",\
"event_entity_type": "activity",\
"event_entity_id": 123,\
"is_entity_master_changed": false,\
"is_entity_datetime_changed": false,\
"is_entity_duration_changed": false,\
"is_entity_labels_changed": false,\
"is_entity_resource_instances_changed": false}]},
"meta": { }}`

## [tag/Raspisaniya-zapisejsobytij/operation/api.location.timetable_event_schedules.days.update](https://developers.yclients.com/ru/\#tag/Raspisaniya-zapisejsobytij/operation/api.location.timetable_event_schedules.days.update) Обновление серии расписания

patch/company/{company\_id}/schedules/{schedule\_id}/days/{day\_id}

https://api.yclients.com/api/v1/company/{company\_id}/schedules/{schedule\_id}/days/{day\_id}

Обновляет настройки серии расписания записей или событий.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |
| schedule\_id<br>required | number<br>Example:123<br>Идентификатор расписания. |
| day\_id<br>required | number<br>Example:123<br>Идентификатор серии расписания. |

##### query Parameters

|     |     |
| --- | --- |
| include | Array of strings<br>ItemsEnum:"events\_master""events\_labels""events\_resource\_instances""events"<br>Набор сущностей, которые должны быть включены в ответ. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| force<br>required | boolean<br>Флаг переопределения ручных изменений в записях/событиях при обновлении серии расписания. |
| events\_master\_id | number<br>Идентификатор сотрудника, оказывающего услуги в рамках серии расписания. |
| events\_time | string<br>Время начала записей или событий в рамках серии расписания (в формате HH:MM:SS). |
| events\_duration | number<br>Длительность записей или событий в рамках серии расписания (в секундах). |
| events\_capacity | number<br>Вместимость событий в рамках серии расписания (для записей значение должно быть равно 1). |
| labels\_ids | Array of numbers<br>Идентификаторы категорий, привязанных к записям или событиям в рамках серии расписания. |
| resource\_instances\_ids | Array of numbers<br>Идентификаторы экземпляров ресурсов, привязанных к записям или событиям в рамках серии расписания. |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object (Объект модели "Серия Расписания") <br>Данные по существующей в филиале серии расписания. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"force": false,
"events_master_id": 123,
"events_time": "14:00:00",
"events_duration": 3600,
"events_capacity": 4,
"labels_ids": [\
123],
"resource_instances_ids": [\
123]}`

### Response samples

- 200
- 401
- 403
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 123,
"created_at": "2022-01-01 12:12:12",
"updated_at": "2022-01-01 12:12:12",
"deleted_at": null,
"timetable_event_schedule_id": 123,
"day_of_week": "mon",
"events_time": "14:00:00",
"events_duration": 3600,
"events_master": {
"id": 123,
"name": "Иван Иванов",
"company_id": 123,
"specialization": "Мастер",
"avatar": "https://yclients.com/images/no-master-sm.png",
"avatar_big": "https://yclients.com/images/no-master.png",
"position": {
"id": 123,
"title": "Сотрудник"}},
"events_labels": [\
{\
"id": 123,\
"title": "Категория",\
"color": "#ff0000"}],
"events_resource_instances": [\
{\
"id": 123,\
"title": "Ресурс #1",\
"resource_id": 123}],
"events": [\
{\
"id": 123,\
"created_at": "2022-01-01 12:12:12",\
"updated_at": "2022-01-01 12:12:12",\
"deleted_at": null,\
"event_status": "stable",\
"event_datetime": "2022-01-24 14:00:00",\
"event_entity_type": "activity",\
"event_entity_id": 123,\
"is_entity_master_changed": false,\
"is_entity_datetime_changed": false,\
"is_entity_duration_changed": false,\
"is_entity_labels_changed": false,\
"is_entity_resource_instances_changed": false}]},
"meta": { }}`

## [tag/Raspisaniya-zapisejsobytij/operation/api.location.timetable_event_schedules.days.delete](https://developers.yclients.com/ru/\#tag/Raspisaniya-zapisejsobytij/operation/api.location.timetable_event_schedules.days.delete) Удаление серии расписания

delete/company/{company\_id}/schedules/{schedule\_id}/days/{day\_id}

https://api.yclients.com/api/v1/company/{company\_id}/schedules/{schedule\_id}/days/{day\_id}

Полностью удаляет серию расписания и все записи или события, привязанные к нему.

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |
| schedule\_id<br>required | number<br>Example:123<br>Идентификатор расписания. |
| day\_id<br>required | number<br>Example:123<br>Идентификатор серии расписания. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

### Responses

**204**
No Content

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

### Response samples

- 204
- 401
- 403
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": null,
"meta": { }}`

## [tag/Raspisaniya-zapisejsobytij/operation/api.location.timetable_event_schedules.days.events.list](https://developers.yclients.com/ru/\#tag/Raspisaniya-zapisejsobytij/operation/api.location.timetable_event_schedules.days.events.list) Получение списка сущностей записей/событий в рамках серии расписания

get/company/{company\_id}/schedules/{schedule\_id}/days/{day\_id}/events

https://api.yclients.com/api/v1/company/{company\_id}/schedules/{schedule\_id}/days/{day\_id}/events

Выводит список сущностей записей или событий, созданных в рамках серии расписания.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |
| schedule\_id<br>required | number<br>Example:123<br>Идентификатор расписания. |
| day\_id<br>required | number<br>Example:123<br>Идентификатор серии расписания. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | Array of objects (Объект модели "Сущность записи/события в Расписании") |
| meta | object (Объект дополнительной информации о запросе с кол-вом найденных результатов) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

### Response samples

- 200
- 401
- 403
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 123,\
"created_at": "2022-01-01 12:12:12",\
"updated_at": "2022-01-01 12:12:12",\
"deleted_at": null,\
"event_status": "stable",\
"event_datetime": "2022-01-24 14:00:00",\
"event_entity_type": "activity",\
"event_entity_id": 123,\
"is_entity_master_changed": false,\
"is_entity_datetime_changed": false,\
"is_entity_duration_changed": false,\
"is_entity_labels_changed": false,\
"is_entity_resource_instances_changed": false,\
"entity_master": {\
"id": 123,\
"name": "Иван Иванов",\
"company_id": 123,\
"specialization": "Мастер",\
"avatar": "https://yclients.com/images/no-master-sm.png",\
"avatar_big": "https://yclients.com/images/no-master.png",\
"position": {\
"id": 123,\
"title": "Сотрудник"}},\
"entity_datetime": "2022-01-24 14:00:00",\
"entity_duration": 3600,\
"entity_labels": [\
{\
"id": 123,\
"title": "Категория",\
"color": "#ff0000"}],\
"entity_resource_instances": [\
{\
"id": 123,\
"title": "Ресурс #1",\
"resource_id": 123}]}],
"meta": {
"count": 10}}`

## [tag/Raspisaniya-zapisejsobytij/operation/api.location.timetable_event_schedules.client_schedules.create](https://developers.yclients.com/ru/\#tag/Raspisaniya-zapisejsobytij/operation/api.location.timetable_event_schedules.client_schedules.create) Создание графика посещений клиента

post/company/{company\_id}/schedules/{schedule\_id}/client\_schedules

https://api.yclients.com/api/v1/company/{company\_id}/schedules/{schedule\_id}/client\_schedules

Создает график посещений клиента, представляющий собой набор записей на события расписания.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |
| schedule\_id<br>required | number<br>Example:123<br>Идентификатор расписания. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| client\_id<br>required | number<br>Идентификатор клиента, для которого будет создан график посещений. |
| comer\_id | number<br>Идентификатор посетителя клиента, для которого будет создан график посещений. |
| schedule\_days\_ids<br>required | Array of numbers\[ 1 .. 7 \] items<br>Идентификаторы серий расписания, минимально 1 серия, максимально 7 серий. |

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object (Объект модели "График посещений клиента") <br>Данные по существующему в филиале графику посещений клиента. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"client_id": 123,
"comer_id": 123,
"schedule_days_ids": [\
123]}`

### Response samples

- 201
- 401
- 403
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 123,
"loyalty_abonement_id": null,
"final_day": "2022-01-01 12:12:12",
"days": [\
{\
"id": 123,\
"created_at": "2022-01-01 12:12:12",\
"updated_at": "2022-01-01 12:12:12",\
"deleted_at": null,\
"timetable_event_schedule_id": 123,\
"day_of_week": "mon",\
"events_time": "14:00:00",\
"events_duration": 3600,\
"events_master": {\
"id": 123,\
"name": "Иван Иванов",\
"company_id": 123,\
"specialization": "Мастер",\
"avatar": "https://yclients.com/images/no-master-sm.png",\
"avatar_big": "https://yclients.com/images/no-master.png",\
"position": {\
"id": 123,\
"title": "Сотрудник"}},\
"events_labels": [\
{\
"id": 123,\
"title": "Категория",\
"color": "#ff0000"}],\
"events_resource_instances": [\
{\
"id": 123,\
"title": "Ресурс #1",\
"resource_id": 123}]}]},
"meta": { }}`

## [tag/Raspisaniya-zapisejsobytij/operation/api.location.timetable_event_schedules.client_schedules.update](https://developers.yclients.com/ru/\#tag/Raspisaniya-zapisejsobytij/operation/api.location.timetable_event_schedules.client_schedules.update) Обновление графика посещений клиента

patch/company/{company\_id}/schedules/{schedule\_id}/client\_schedules/{client\_schedule\_id}

https://api.yclients.com/api/v1/company/{company\_id}/schedules/{schedule\_id}/client\_schedules/{client\_schedule\_id}

Обновляет график посещений клиента, прикрепляя или открепляя серии расписания, что вызывает создание новых или удаление существующих записей клиента в будущих событиях расписания.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |
| schedule\_id<br>required | number<br>Example:123<br>Идентификатор расписания. |
| client\_schedule\_id<br>required | number<br>Example:123<br>Идентификатор графика посещений клиента. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| schedule\_days\_ids<br>required | Array of numbers\[ 1 .. 7 \] items<br>Идентификаторы серий расписания, минимально 1 серия, максимально 7 серий. |

### Responses

**200**
OK

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object (Объект модели "График посещений клиента") <br>Данные по существующему в филиале графику посещений клиента. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"schedule_days_ids": [\
123]}`

### Response samples

- 200
- 401
- 403
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 123,
"loyalty_abonement_id": null,
"final_day": "2022-01-01 12:12:12",
"days": [\
{\
"id": 123,\
"created_at": "2022-01-01 12:12:12",\
"updated_at": "2022-01-01 12:12:12",\
"deleted_at": null,\
"timetable_event_schedule_id": 123,\
"day_of_week": "mon",\
"events_time": "14:00:00",\
"events_duration": 3600,\
"events_master": {\
"id": 123,\
"name": "Иван Иванов",\
"company_id": 123,\
"specialization": "Мастер",\
"avatar": "https://yclients.com/images/no-master-sm.png",\
"avatar_big": "https://yclients.com/images/no-master.png",\
"position": {\
"id": 123,\
"title": "Сотрудник"}},\
"events_labels": [\
{\
"id": 123,\
"title": "Категория",\
"color": "#ff0000"}],\
"events_resource_instances": [\
{\
"id": 123,\
"title": "Ресурс #1",\
"resource_id": 123}]}]},
"meta": { }}`

## [tag/Raspisaniya-zapisejsobytij/operation/api.location.timetable_event_schedules.client_schedules.delete](https://developers.yclients.com/ru/\#tag/Raspisaniya-zapisejsobytij/operation/api.location.timetable_event_schedules.client_schedules.delete) Удаление графика посещений клиента

delete/company/{company\_id}/schedules/{schedule\_id}/client\_schedules/{client\_schedule\_id}

https://api.yclients.com/api/v1/company/{company\_id}/schedules/{schedule\_id}/client\_schedules/{client\_schedule\_id}

Полностью удаляет график посещений клиента и все записи данного клиента в рамках будущих событий расписания.

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | number<br>Example:123<br>Идентификатор филиала. |
| schedule\_id<br>required | number<br>Example:123<br>Идентификатор расписания. |
| client\_schedule\_id<br>required | number<br>Example:123<br>Идентификатор графика посещений клиента. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

### Responses

**204**
No Content

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

### Response samples

- 204
- 401
- 403
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": null,
"meta": { }}`

# [tag/Marketplejs](https://developers.yclients.com/ru/\#tag/Marketplejs) Маркетплейс

Настройка уведомлений в визарде внутри витрины уведомлений проходит в несколько этапов

- Компания-партнер должна передать всю необходимую информацию для технической реализации интеграции: домен, адрес для регистрации пользователя, адрес для получения коллбеков по событиям.
- Пользователь YCLIENTS подтверждает согласие с условиями интеграции, происходит редирект на страницу регистрации в сервисе партнера. К роуту мы добавляем GET параметр salon\_id, в котором хранится ID филиала, запросившего регистрацию.
- После регистрации необходимо отправить пользователя обратно в YCLIENTS, переадресовав на [соответствующий роут](https://developers.yclients.com/#operation/marketplace.notifications.callback_with_settings).
- При успешной оплате услуг сервиса, необходимо уведомить YCLIENTS, послав пинг на [соответствующий роут](https://developers.yclients.com/#operation/marketplace.notifications.callback_with_payment).

## [tag/Marketplejs/operation/marketplace.notifications.callback_with_settings_and_redirect](https://developers.yclients.com/ru/\#tag/Marketplejs/operation/marketplace.notifications.callback_with_settings_and_redirect) Адрес для редиректа пользователя после регистрации в сервисе-партнере

post/marketplace/partner/callback/redirect

https://api.yclients.com/marketplace/partner/callback/redirect

На этот адрес необходимо перенаправить пользователя в браузере после прохождения регистрации с данными, которые необходимы сервису-партнеру

##### Authorizations:

_bearer_

##### Request Body schema: application/json

|     |     |
| --- | --- |
| salon\_id<br>required | number<br>Идентификатор филиала. |
| application\_id<br>required | number<br>Идентификатор приложения (выдается после создания в витрине YCLIENTS). |
| api\_key | number<br>API-ключ для отправки уведомлений. |
| webhook\_urls | Array of strings<br>Массив адресов вебхуков. |

### Responses

**301**
Параметры сохранены успешно, редирект на дальнейшую настройку

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**422**
Переданы невалидные параметры

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"salon_id": 123,
"application_id": 123,
"api_key": "2f181e2a-5c22-4ae7-9d9b-07104f312c28",
"webhook_urls": [\
"https://example.com/webhook"]}`

### Response samples

- 401
- 403
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": false,
"data": null,
"meta": {
"message": "Необходима авторизация"}}`

## [tag/Marketplejs/operation/marketplace.notifications.callback_with_settings](https://developers.yclients.com/ru/\#tag/Marketplejs/operation/marketplace.notifications.callback_with_settings) Установка приложения для филиала

post/marketplace/partner/callback

https://api.yclients.com/marketplace/partner/callback

На этот адрес необходимо направить настройки интеграции сервиса-партнера, после чего будет произведена настройка и установка приложения в филиале

##### Authorizations:

_bearer_

##### Request Body schema: application/json

|     |     |
| --- | --- |
| salon\_id<br>required | number<br>Идентификатор филиала. |
| application\_id<br>required | number<br>Идентификатор приложения (выдается после создания в витрине YCLIENTS). |
| api\_key | number<br>API-ключ для отправки уведомлений. |
| webhook\_urls | Array of strings<br>Массив адресов вебхуков. |
| channels | Array of strings<br>ItemsEnum:"sms""whatsapp"<br>Каналы, по которым доступна отправка уведомлений (только для приложений из категорий Чат-Боты и СМС-агрегаторы). |

### Responses

**201**
Параметры сохранены успешно, приложение установлено

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**422**
Переданы невалидные параметры

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"salon_id": 123,
"application_id": 123,
"api_key": "2f181e2a-5c22-4ae7-9d9b-07104f312c28",
"webhook_urls": [\
"https://example.com/webhook"],
"channels": [\
"sms",\
"whatsapp"]}`

### Response samples

- 401
- 403
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": false,
"data": null,
"meta": {
"message": "Необходима авторизация"}}`

## [tag/Marketplejs/operation/marketplace.notifications.callback_with_payment](https://developers.yclients.com/ru/\#tag/Marketplejs/operation/marketplace.notifications.callback_with_payment) Уведомление YCLIENTS об успешном платеже

post/marketplace/partner/payment

https://api.yclients.com/marketplace/partner/payment

На данный адрес необходимо присылать webhook-уведомление об успешной оплате услуг на стороне сервиса-партнера

##### Authorizations:

_bearer_

##### Request Body schema: application/json

|     |     |
| --- | --- |
| salon\_id<br>required | number<br>Идентификатор филиала. |
| application\_id<br>required | number<br>Идентификатор приложения (выдается после создания в витрине YCLIENTS). |
| payment\_sum<br>required | number<br>Сумма платежа. |
| currency\_iso<br>required | string<br>ISO валюты платежа (например: RUB, EUR, BYN) |
| payment\_date<br>required | string<br>Дата и время платежа. |
| period\_from<br>required | string<br>Дата, с которой начинается оплаченный период (включительно). |
| period\_to<br>required | string<br>Дата, которой заканчивается оплаченный период (включительно). |

### Responses

**200**
Вебхук обработан

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Статус запроса.) <br>Статус запроса. |
| data | object<br>Данные по запросу. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**422**
Переданы невалидные параметры

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Request samples

- Payload

Content type

application/json

Copy

`{
"salon_id": 123,
"application_id": 123,
"payment_sum": 990.99,
"currency_iso": "RUB",
"payment_date": "2022-01-01 10:10:00",
"period_from": "2022-01-01 10:10:00",
"period_to": "2022-02-01 10:10:00"}`

### Response samples

- 200
- 401
- 403
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 123}}`

## [tag/Marketplejs/operation/marketplace.notifications.set_short_names](https://developers.yclients.com/ru/\#tag/Marketplejs/operation/marketplace.notifications.set_short_names) Оповещение YCLIENTS о доступных именах отправителя SMS-сообщений

post/marketplace/partner/short\_names

https://api.yclients.com/marketplace/partner/short\_names

Этот адрес предназначен для отправки в YCLIENTS доступных пользователю именах отправителя SMS-сообщений. Пользователь будет иметь возможность выбрать любое доступное из переданных

##### Authorizations:

_bearer_

##### Request Body schema: application/json

|     |     |
| --- | --- |
| salon\_id<br>required | number<br>Идентификатор филиала. |
| application\_id<br>required | number<br>Идентификатор приложения (выдается после создания в витрине YCLIENTS). |
| short\_names<br>required | Array of strings<br>Массив коротких имен отправителя SMS-сообщений |

### Responses

**201**
Вебхук обработан

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**422**
Переданы невалидные параметры

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"salon_id": 123,
"application_id": 123,
"short_names": [\
"YCLIENTS",\
"YC"]}`

### Response samples

- 401
- 403
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": false,
"data": null,
"meta": {
"message": "Необходима авторизация"}}`

## [tag/Marketplejs/operation/marketplace.partner.callback_with_payment.refund](https://developers.yclients.com/ru/\#tag/Marketplejs/operation/marketplace.partner.callback_with_payment.refund) Уведомление о возврате платежа

post/marketplace/partner/payment/refund/{payment\_id}

https://api.yclients.com/marketplace/partner/payment/refund/{payment\_id}

Адрес предназначен для уведомления YCLIENTS о возврате платежа

##### Authorizations:

_bearer_

##### path Parameters

|     |     |
| --- | --- |
| payment\_id<br>required | number<br>Example:123<br>Идентификатор платежа для отмены. |

### Responses

**200**
Возврат зафиксирован

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**422**
Переданы невалидные параметры

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Response samples

- 401
- 403
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": false,
"data": null,
"meta": {
"message": "Необходима авторизация"}}`

## [tag/Marketplejs/operation/marketplace.webhook](https://developers.yclients.com/ru/\#tag/Marketplejs/operation/marketplace.webhook) Вебхук из YCLIENTS о событиях

post/marketplace\_webhook

https://api.yclients.com/marketplace\_webhook

Это не действующий эндпойнт.
Здесь описывается отправка вебхуков из YCLIENTS при возникновении определенных событий в процессе жизненного цикла "приложение - салон".
В данный момент доступны события к получению:

- uninstall - событие отправляется при отключении приложения на стороне YCLIENTS.
- freeze - событие отправляется при заморозке интеграции вследствие экспирации.

Настроить адрес для получения вебхуков можно в личном кабинете разработчика YCLIENTS.

##### Request Body schema: application/json

|     |     |
| --- | --- |
| salon\_id<br>required | number<br>Идентификатор филиала. |
| application\_id<br>required | number<br>Идентификатор приложения. |
| event<br>required | string<br>Enum:"uninstall""freeze"<br>Slug произошедшего события. |
| partner\_token<br>required | string<br>Bearer токен компании разработчика (для удостоверения происхождения вебхука). |

### Responses

**200**
Со стороны партнера ожидается код ответа об успешной обработке (200-299).

### Request samples

- Payload

Content type

application/json

Copy

`{
"salon_id": 123,
"application_id": 123,
"event": "uninstall",
"partner_token": "yasdfkjah2328aj"}`

## [tag/Marketplejs/operation/marketplace.partner.integration_status](https://developers.yclients.com/ru/\#tag/Marketplejs/operation/marketplace.partner.integration_status) Данные о подключении приложения в салоне

get/marketplace/salon/{salon\_id}/application/{application\_id}

https://api.yclients.com/marketplace/salon/{salon\_id}/application/{application\_id}

Данный эндпойнт предназначен для получения информации об установке приложения в конкретном салоне.

##### Authorizations:

_bearer_

##### path Parameters

|     |     |
| --- | --- |
| salon\_id<br>required | number<br>ID филиала |
| application\_id<br>required | number<br>ID приложения |

### Responses

**200**
Данные о связке приложения с салоном

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Не передан токен партнера.

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Нет доступа к приложению.

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Приложение не установлено в салоне.

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

### Response samples

- 200
- 401
- 403
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"logs": [\
{\
"changed_at": "2022-06-27 12:20:02",\
"status_from": "uninstalled",\
"status_to": "pending",\
"source": "marketplace"},\
{\
"changed_at": "2022-06-27 12:22:02",\
"status_from": "pending",\
"status_to": "active",\
"source": "partner_api"}],
"payments": [\
{\
"id": 1233,\
"payment_sum": 1523.12,\
"currency_iso": "RUB",\
"payment_date": "2022-06-27 12:22:02",\
"is_refunded": false,\
"period_from": "2022-06-27 00:00:00",\
"period_to": "2022-07-27 00:00:00"}],
"connection_status": {
"status": "active",
"created_at": "2022-06-27 12:20:02"}}}`

## [tag/Marketplejs/operation/marketplace.partner.application_salon_list](https://developers.yclients.com/ru/\#tag/Marketplejs/operation/marketplace.partner.application_salon_list) Данные о салонах, подключивших приложение

get/marketplace/application/{application\_id}/salons

https://api.yclients.com/marketplace/application/{application\_id}/salons

Данный эндпойнт предназначен для получения списка салонов, которые подключили некоторое приложение, с подробной информацией о них

##### Authorizations:

_bearer_

##### path Parameters

|     |     |
| --- | --- |
| application\_id<br>required | number<br>ID приложения в маркетплейсе |

##### query Parameters

|     |     |
| --- | --- |
| page<br>required | number<br>Страница списка |
| count<br>required | number<= 1000<br>Кол-во элементов на странице списка |

### Responses

**200**
Массив салонов

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешного выполнения (true) |
| data | Array of objects<br>Массив объектов |
| meta | Array of objects<br>Метаданные (пустой массив) |

**401**
Не передан токен партнера.

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Нет доступа к приложению.

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

### Response samples

- 200
- 401
- 403

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": "1050",\
"title": "Ля Визаж",\
"short_descr": "Салон красоты",\
"logo": "https://yclients.com/images/no-master.png",\
"active": "1",\
"phone": "+7 495 509-24-46",\
"country_id": 1,\
"schedule": "",\
"country": "Россия",\
"city_id": 1,\
"city": "Москва",\
"timezone_name": "Europe/Moscow",\
"address": "Талалихина, д. 1, к. 2",\
"coordinate_lat": "55.735662",\
"coordinate_lon": "37.678218",\
"phone_confirmation": true,\
"active_staff_count": 2,\
"next_slot": "2023-03-23T10:10:00+0300",\
"app_ios": "",\
"app_android": "",\
"currency_short_title": "р",\
"group_priority": 900},\
{\
"id": "1051",\
"title": "Ля Визаж 2",\
"short_descr": "Салон красоты",\
"logo": "https://yclients.com/images/no-master.png",\
"active": "1",\
"phone": "+7 495 509-24-46",\
"country_id": 1,\
"country": "Россия",\
"city_id": 1,\
"city": "Москва",\
"timezone_name": "Europe/Moscow",\
"address": "Талалихина, д. 1, к. 2",\
"coordinate_lat": "55.835662",\
"coordinate_lon": "37.778218",\
"phone_confirmation": false,\
"active_staff_count": 3,\
"next_slot": "2023-03-23T10:10:00+0300",\
"app_ios": "",\
"app_android": "",\
"currency_short_title": "р",\
"group_priority": 901}],
"meta": { }}`

## [tag/Marketplejs/operation/marketplace.partner.uninstall](https://developers.yclients.com/ru/\#tag/Marketplejs/operation/marketplace.partner.uninstall) Отключение приложения

post/marketplace/salon/{salon\_id}/application/{application\_id}/uninstall

https://api.yclients.com/marketplace/salon/{salon\_id}/application/{application\_id}/uninstall

Данный эндпойнт предназначен для инициирования отключения приложения со стороны партнера.

##### Authorizations:

_bearer_

##### path Parameters

|     |     |
| --- | --- |
| salon\_id<br>required | number<br>ID филиала |
| application\_id<br>required | number<br>ID приложения |

### Responses

**200**
Успешно отключено

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Не передан токен партнера.

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Нет доступа к приложению.

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Приложение не установлено в салоне.

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

### Response samples

- 200
- 401
- 403
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": null,
"meta": { }}`

## [tag/Marketplejs/operation/marketplace.partner.application_payment_link](https://developers.yclients.com/ru/\#tag/Marketplejs/operation/marketplace.partner.application_payment_link) Генерация ссылки на оплату

get/marketplace/application/payment\_link

https://api.yclients.com/marketplace/application/payment\_link

Эндпойнт предназначен для генерации ссылки на оплату приложения через YCLIENTS

##### Authorizations:

_bearer_

##### query Parameters

|     |     |
| --- | --- |
| salon\_id<br>required | number<br>ID филиала |
| application\_id<br>required | number<br>ID приложения |
| discount | number<br>Example:discount=15.55<br>Размер скидки в процентах (опционально) |

### Responses

**200**
Ссылка на оплату

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object<br>Объект со ссылкой на оплату |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Не передан токен партнера.

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Нет доступа к приложению.

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Приложение не установлено в салоне.

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

### Response samples

- 200
- 401
- 403
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"url": "https://yclients.com/appstore/payment/?salon_id=1111&application_id=1&discount=15.5&source=api&sign=6f9b5bc6fa787780161ed090af9429d5af963562b7a6ac8051888147370674be"}}`

## [tag/Marketplejs/operation/marketplace.partner.applications.tariffs.list](https://developers.yclients.com/ru/\#tag/Marketplejs/operation/marketplace.partner.applications.tariffs.list) Данные о тарифах приложения

get/marketplace/application/{application\_id}/tariffs

https://api.yclients.com/marketplace/application/{application\_id}/tariffs

Данный эндпойнт предназначен для получения списка тарифов.

##### Authorizations:

_bearer_

##### path Parameters

|     |     |
| --- | --- |
| application\_id<br>required | number<br>ID приложения |

### Responses

**200**
Данные о связке приложения с салоном

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | Array of objects<br>Список тарифов |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Не передан токен партнера.

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Нет доступа к приложению.

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Приложение не установлено в салоне.

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

### Response samples

- 200
- 401
- 403
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 89,\
"title": "1 месяц",\
"options": [\
{\
"id": 123,\
"title": "Частный мастер",\
"overall_price": 500,\
"duration_in_months": 1,\
"staff_amount": 1,\
"free_period_in_months": 0,\
"currency_iso": "RUB"},\
{\
"id": 124,\
"title": "До 2-х сотрудников",\
"overall_price": 990,\
"duration_in_months": 1,\
"staff_amount": 1,\
"free_period_in_months": 0,\
"currency_iso": "RUB"}]}]}`

## [tag/Marketplejs/operation/marketplace.partner.application_add_discount](https://developers.yclients.com/ru/\#tag/Marketplejs/operation/marketplace.partner.application_add_discount) Установить скидку салонам на оплату

post/marketplace/application/add\_discount

https://api.yclients.com/marketplace/application/add\_discount

Данный эндпойнт предназначен для установки скидки при оплате через YCLIENTS определенным салонам

##### Authorizations:

_bearer_

##### Request Body schema: application/json

|     |     |
| --- | --- |
| salon\_ids<br>required | Array of numbers<br>Список ID салонов |
| application\_id<br>required | number<br>Идентификатор приложения. |
| discount<br>required | number<br>Величина скидки |

### Responses

**200**
Скидка успешно установлена

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Не передан токен партнера.

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Нет доступа к приложению.

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Приложение не установлено в салоне.

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"salon_ids": [\
123,\
432],
"application_id": 123,
"discount": 15.54}`

### Response samples

- 200
- 401
- 403
- 404

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": null,
"meta": { }}`

## [tag/Marketplejs/operation/marketplace.partner.applications.update_channel](https://developers.yclients.com/ru/\#tag/Marketplejs/operation/marketplace.partner.applications.update_channel) Изменение доступности каналов отправки

post/marketplace/application/update\_channel

https://api.yclients.com/marketplace/application/update\_channel

Только для приложений из категории Чат-Боты и СМС-агрегаторы. Позволяет изменить доступные каналы отправки уведомлений для приложения.

##### Authorizations:

_bearer_

##### Request Body schema: application/json

|     |     |
| --- | --- |
| salon\_id<br>required | number<br>Идентификатор филиала. |
| application\_id<br>required | number<br>Идентификатор приложения (выдается после создания в витрине YCLIENTS). |
| channel\_slug<br>required | string<br>Enum:"sms""whatsapp"<br>Канал, доступность которого необходимо изменить. |
| is\_available<br>required | boolean<br>Флаг доступности канала отправки. |

### Responses

**200**
Канал отправки для салона обновлен

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**422**
Переданы невалидные параметры

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Request samples

- Payload

Content type

application/json

Copy

`{
"salon_id": 123,
"application_id": 123,
"channel_slug": "sms",
"is_available": true}`

### Response samples

- 401
- 403
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": false,
"data": null,
"meta": {
"message": "Необходима авторизация"}}`

# [tag/Tipy-abonementov](https://developers.yclients.com/ru/\#tag/Tipy-abonementov) Типы абонементов

## [tag/Tipy-abonementov/operation/api.loyalty.abonement_types.create](https://developers.yclients.com/ru/\#tag/Tipy-abonementov/operation/api.loyalty.abonement_types.create) Создание типа абонемента

post/chain/{chain\_id}/loyalty/abonement\_types

https://api.yclients.com/api/v1/chain/{chain\_id}/loyalty/abonement\_types

Создает новый тип абонемента в сети; при создании можно указать филиалы в которых будет доступна сущность.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| chain\_id<br>required | number<br>Example:123<br>Идентификатор сети. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| title<br>required | string<br>Название типа абонемента. |
| salon\_group\_id<br>required | number<br>Идентификатор сети. |
| cost<br>required | number<br>Цена абонемента |
| salon\_ids | Array of numbers<br>Список ID филиалов. |
| period | number<br>Продолжительность периода действия. |
| period\_unit\_id | integer<br>Тип единиц (1 - день, 2 - неделя, 3 - месяц, 4 - год). |
| allow\_freeze | boolean<br>Возможность заморозки. |
| freeze\_limit | integer<br>Максимальный общий период заморозки |
| freeze\_limit\_unit\_id | integer<br>Единица измерения срока заморозки абонемента (1 - день, 2 - неделя, 3 - месяц, 4 - год). |
| service\_price\_correction | boolean<br>Возможность корректировки цены услуги при применении абонемента. |
| expiration\_type\_id | integer<br>Тип активации абонемента (1 - при продаже, 2 - при первом использовании, 3 - с конкретной даты). |
| is\_allow\_empty\_code | boolean<br>Общий или именной абонемент.<br>true - именной абонемент пользуется только один человек, который его купил.<br>false - могут пользоваться несколько человек по специальному коду. |
| is\_united\_balance<br>required | boolean<br>Признак общего баланса (true - общий баланс, false - раздельный). |
| united\_balance\_services\_count<br>required | integer<br>Количество посещений при общем балансе. |
| balance\_edit\_type\_id | integer<br>Тип корректировки баланса (0 - корректировка запрещена, 1 - в филиале где был продан абонемент, 2 - во всех филиалах). |
| is\_online\_sale\_enabled | boolean<br>Онлайн продажа (true - разрешена, false - запрещена). Если параметр передан равным true, то тогда параметр online\_sale\_price обязателен. |
| online\_sale\_title | string<br>Название абонемента при онлайн продаже. |
| online\_sale\_description | string<br>Описание абонемента при онлайн продаже. |
| online\_sale\_price | number<br>Цена абонемента при онлайн продаже. |
| online\_image | string<br>Изображение абонемента при онлайн продаже. |
| autoactivation\_period | integer<br>Максимальный период автоактивации. |
| autoactivation\_time\_in\_days | integer<br>Количество единиц времени для автоактивации абонемента. |
| autoactivation\_time\_unit\_id | integer<br>Единицы измерения для автоактивации (1 - дни, 2 - недели, 3 - месяцы, 4 - годы). |
| is\_archived | boolean<br>Признак архивации абонемента. |
| services | Array of integers<br>Список ID услуг. |
| service\_categories<br>required | Array of integers<br>Список ID категорий услуг. |
| availability | Array of objects<br>Список условий времени действия абонемента, при пустом массиве абонемент действует в любое время. |

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Успешный статус запроса) <br>Статус запроса. |
| data | object (Объект модели "Тип абонемента") |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"title": "Абонемент на фитнес",
"salon_group_id": 1,
"cost": 500,
"salon_ids": [\
123,\
432],
"period": 30,
"period_unit_id": 1,
"allow_freeze": false,
"freeze_limit": 14,
"freeze_limit_unit_id": 1,
"service_price_correction": true,
"expiration_type_id": 1,
"is_allow_empty_code": true,
"is_united_balance": false,
"united_balance_services_count": 10,
"balance_edit_type_id": 3,
"is_online_sale_enabled": false,
"online_sale_title": "online sale title",
"online_sale_description": "online sale description",
"online_sale_price": 550,
"online_image": "string",
"autoactivation_period": 3,
"autoactivation_time_in_days": 10,
"autoactivation_time_unit_id": 1,
"is_archived": false,
"services": [\
123,\
432],
"service_categories": [\
123,\
432],
"availability": [\
{\
"week_days": [\
1,\
2,\
3],\
"intervals": [\
{\
"from": 1,\
"to": 10000},\
{\
"from": 15000,\
"to": 35000}]}]}`

### Response samples

- 201
- 401
- 403
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": {
"id": 777,
"salon_group_id": 333,
"title": "Абонемент на 10 посещений",
"period": 10,
"period_unit_id": 1,
"allow_freeze": true,
"freeze_limit": 30,
"freeze_limit_unit_id": 1,
"is_allow_empty_code": false,
"is_united_balance": true,
"cost": 1000,
"expiration_type_id": 1,
"is_online_sale_enabled": false,
"online_sale_title": "Абонемент на 10 посещений",
"online_sale_description": "Продается онлайн со скидкой",
"online_sale_price": 550,
"service_price_correction": true,
"united_balance_services_count": 10,
"autoactivation_time": 10,
"autoactivation_time_unit_id": 1,
"attached_salon_ids": [\
1,\
2,\
3],
"online_sale_image": "https://yclients.com/images/abonement_type.png",
"availability": [\
{\
"week_days": [\
1,\
2,\
3],\
"intervals": [\
{\
"from": 3600,\
"to": 7200},\
{\
"from": 10800,\
"to": 14400}]},\
{\
"week_days": [\
6,\
7],\
"intervals": [\
{\
"from": 36000,\
"to": 72000}]}],
"balance_container": {
"links": [\
{\
"count": 10,\
"service": {\
"id": 45,\
"is_category": false,\
"category_id": 90,\
"category": {\
"id": 90,\
"is_category": true,\
"category_id": 1,\
"title": "Первая категория услуг в филиале"},\
"title": "Услуга в филиале"}},\
{\
"count": 15,\
"category": {\
"id": 91,\
"is_category": true,\
"category_id": 1,\
"title": "Вторая категория услуг в филиале"}}]}},
"meta": { }}`

## [tag/Tipy-abonementov/operation/api.loyalty.abonement_types.update](https://developers.yclients.com/ru/\#tag/Tipy-abonementov/operation/api.loyalty.abonement_types.update) Обновление типа абонемента

put/chain/{chain\_id}/loyalty/abonement\_types/{loyalty\_abonement\_type\_id}

https://api.yclients.com/api/v1/chain/{chain\_id}/loyalty/abonement\_types/{loyalty\_abonement\_type\_id}

Обновляет тип абонемента по идентификатору.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| chain\_id<br>required | number<br>Example:123<br>Идентификатор сети. |
| abonement\_type\_id<br>required | integer<br>Example:34<br>Идентификатор типа абонемента. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| title<br>required | string<br>Название типа абонемента. |
| salon\_group\_id<br>required | number<br>Идентификатор сети. |
| cost<br>required | number<br>Цена абонемента. |
| salon\_ids | Array of numbers<br>Список ID филиалов. |
| period | number<br>Продолжительность периода действия. |
| period\_unit\_id | integer<br>Тип единиц измерения продолжительности периода действия типа абонемента (1 - день, 2 - неделя, 3 - месяц, 4 - год). |
| allow\_freeze | boolean<br>Возможность заморозки. |
| freeze\_limit | integer<br>Максимальный общий период заморозки. |
| freeze\_limit\_unit\_id | integer<br>Единица измерения срока заморозки абонемента (1 - день, 2 - неделя, 3 - месяц, 4 - год). |
| service\_price\_correction | boolean<br>Возможность корректировки цены услуги при применении абонемента. |
| expiration\_type\_id | integer<br>Тип активации абонемента (1 - при продаже, 2 - при первом использовании, 3 - с конкретной даты). |
| is\_allow\_empty\_code | boolean<br>Общий или именной абонемент.<br>true - именной абонемент пользуется только один человек, который его купил.<br>false - могут пользоваться несколько человек по специальному коду. |
| is\_united\_balance<br>required | boolean<br>Признак общего баланса (true - общий баланс, false - раздельный). |
| united\_balance\_services\_count<br>required | integer<br>Кол-во посещений при общем балансе. |
| balance\_edit\_type\_id | integer<br>Тип корректировки баланса (0 - корректировка запрещена, 1 - в филиале где был продан абонемент, 2 - во всех филиалах). |
| is\_online\_sale\_enabled | boolean<br>Онлайн продажа (true - разрешена, false - запрещена). |
| online\_sale\_title | string<br>Название абонемента при онлайн продаже. |
| online\_sale\_description | string<br>Описание абонемента при онлайн продаже. |
| online\_sale\_price | number<br>Цена абонемента при онлайн продаже. |
| online\_image | string<br>Изображение абонемента при онлайн продаже. |
| autoactivation\_period | integer<br>Максимальный период автоактивации. |
| autoactivation\_time | integer<br>Кол-во единиц времени для автоактивации типа абонемента. |
| autoactivation\_time\_unit\_id | integer<br>Единицы измерения для автоактивации (1 - дни, 2 - недели, 3 - месяцы, 4 - годы). |
| is\_archived | boolean<br>Признак архивации абонемента. |
| services | Array of integers<br>Список ID услуг привязанных к типу абонемента. |
| service\_categories<br>required | Array of integers<br>Список ID категорий услуг привязанных к типу абонемента. |
| availability | Array of objects<br>Список условий времени действия абонемента, при пустом массиве абонемент действует в любое время. |

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| id | number<br>Идентификатор типа абонемента. |
| salon\_group\_id | number<br>Идентификатор сети, в которой действует тип абонемента. |
| title | string<br>Название типа абонементы. |
| period | number<br>Срок действия абонемента (0, если не задан). |
| period\_unit\_id | number<br>Единица измерения срока действия абонемента (1 - день, 2 - неделя, 3 - месяц, 4 - год, если не задан - 0). |
| allow\_freeze | boolean<br>Допускается ли заморозка абонементов: true - допускается, false - не допускается. |
| freeze\_limit | number<br>Максимальный общий период заморозки. |
| freeze\_limit\_unit\_id | number<br>Единица измерения срока заморозки абонемента (1 - день, 2 - неделя, 3 - месяц, 4 - год). |
| is\_allow\_empty\_code | boolean<br>Разрешить продажу абонемента без кода: true - разрешить, false - не разрешать. |
| is\_united\_balance | boolean<br>Общий или раздельный баланс абонемента: true - общий, false - раздельный. |
| cost | number<br>Цена абонемента. |
| expiration\_type\_id | number<br>Тип активации абонемента (1 - при продаже, 2 - при первом использовании, 3 - с конкретной даты). |
| is\_online\_sale\_enabled | boolean<br>Онлайн продажа (true - разрешена, false - запрещена). |
| online\_sale\_title | string<br>Название абонемента при онлайн продаже. |
| online\_sale\_description | string<br>Описание абонемента при онлайн продаже. |
| online\_sale\_price | number<br>Цена абонемента при продаже онлайн. |
| service\_price\_correction | boolean<br>Возможность корректировки цены услуги при применении абонемента. |
| united\_balance\_services\_count | number<br>Количество посещений для общего баланса. |
| autoactivation\_time | number<br>Кол-во единиц времени для автоактивации абонемента. |
| autoactivation\_time\_unit\_id | integer<br>Единицы измерения для автоактивации (1 - дни, 2 - недели, 3 - месяцы, 4 - годы). |
| attached\_salon\_ids | Array of numbers<br>Список ID прикреплённых к типу абонемента филиалов. |
| online\_sale\_image | string<br>Ссылка на изображение при онлайн продаже. |
| availability | Array of objects (Объект модели "Период доступности абонемента".) <br>Список условий доступности абонемента. |
| balance\_container | object (Объект модели "Баланс абонемента".) <br>Объект с массивом прикрепленных услуг и/или категорий и их балансом. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Request samples

- Payload

Content type

application/json

Copy
Expand all  Collapse all

`{
"title": "Абонемент на йогу",
"salon_group_id": 1,
"cost": 500,
"salon_ids": [\
123,\
432],
"period": 30,
"period_unit_id": 1,
"allow_freeze": false,
"freeze_limit": 30,
"freeze_limit_unit_id": 1,
"service_price_correction": true,
"expiration_type_id": 1,
"is_allow_empty_code": true,
"is_united_balance": false,
"united_balance_services_count": 10,
"balance_edit_type_id": 3,
"is_online_sale_enabled": false,
"online_sale_title": "online sale title",
"online_sale_description": "online sale description",
"online_sale_price": 550,
"online_image": "string",
"autoactivation_period": 3,
"autoactivation_time": 10,
"autoactivation_time_unit_id": 1,
"is_archived": false,
"services": [\
123,\
432],
"service_categories": [\
123,\
432],
"availability": [\
{\
"week_days": [\
1,\
2,\
5],\
"intervals": [\
{\
"from": 1,\
"to": 10000},\
{\
"from": 15000,\
"to": 35000}]}]}`

### Response samples

- 201
- 401
- 403
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"id": 777,
"salon_group_id": 333,
"title": "Абонемент на 10 посещений",
"period": 10,
"period_unit_id": 1,
"allow_freeze": true,
"freeze_limit": 30,
"freeze_limit_unit_id": 1,
"is_allow_empty_code": false,
"is_united_balance": true,
"cost": 1000,
"expiration_type_id": 1,
"is_online_sale_enabled": false,
"online_sale_title": "Абонемент на 10 посещений",
"online_sale_description": "Продается онлайн со скидкой",
"online_sale_price": 550,
"service_price_correction": true,
"united_balance_services_count": 10,
"autoactivation_time": 10,
"autoactivation_time_unit_id": 1,
"attached_salon_ids": [\
1,\
2,\
3],
"online_sale_image": "https://yclients.com/images/abonement_type.png",
"availability": [\
{\
"week_days": [\
1,\
2,\
3],\
"intervals": [\
{\
"from": 3600,\
"to": 7200},\
{\
"from": 10800,\
"to": 14400}]},\
{\
"week_days": [\
6,\
7],\
"intervals": [\
{\
"from": 36000,\
"to": 72000}]}],
"balance_container": {
"links": [\
{\
"count": 10,\
"service": {\
"id": 45,\
"is_category": false,\
"category_id": 90,\
"category": {\
"id": 90,\
"is_category": true,\
"category_id": 1,\
"title": "Первая категория услуг в филиале"},\
"title": "Услуга в филиале"}},\
{\
"count": 15,\
"category": {\
"id": 91,\
"is_category": true,\
"category_id": 1,\
"title": "Вторая категория услуг в филиале"}}]}}`

## [tag/Tipy-abonementov/operation/api.loyalty.abonement_types.delete](https://developers.yclients.com/ru/\#tag/Tipy-abonementov/operation/api.loyalty.abonement_types.delete) Удаление типа абонемента

delete/chain/{chain\_id}/loyalty/abonement\_types/{loyalty\_abonement\_type\_id}

https://api.yclients.com/api/v1/chain/{chain\_id}/loyalty/abonement\_types/{loyalty\_abonement\_type\_id}

Удаление типа абонемента.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| chain\_id<br>required | number<br>Example:123<br>Идентификатор сети. |
| abonement\_type\_id<br>required | integer<br>Example:34<br>Идентификатор типа абонемента. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

##### Request Body schema: application/json

_Schema not provided_

### Responses

**204**
No Content

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Response samples

- 401
- 403
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": false,
"data": null,
"meta": {
"message": "Необходима авторизация"}}`

## [tag/Tipy-abonementov/operation/api.loyalty.abonement_types.restore](https://developers.yclients.com/ru/\#tag/Tipy-abonementov/operation/api.loyalty.abonement_types.restore) Восстановление удалённого типа абонемента

post/chain/{chain\_id}/loyalty/abonement\_types/{loyalty\_abonement\_type\_id}

https://api.yclients.com/api/v1/chain/{chain\_id}/loyalty/abonement\_types/{loyalty\_abonement\_type\_id}

Восстановление удалённого типа абонемента.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| chain\_id<br>required | number<br>Example:123<br>Идентификатор сети. |
| abonement\_type\_id<br>required | integer<br>Example:34<br>Идентификатор типа абонемента. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| restore\_in\_title<br>required | boolean<br>Новое название типа абонемента, которое сохранится после восстановления типа абонемента. |

### Responses

**204**
No Content

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Request samples

- Payload

Content type

application/json

Copy

`{
"restore_in_title": "Абонемент в солярий"}`

### Response samples

- 401
- 403
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": false,
"data": null,
"meta": {
"message": "Необходима авторизация"}}`

## [tag/Tipy-abonementov/operation/api.loyalty.abonement_types.state_modification](https://developers.yclients.com/ru/\#tag/Tipy-abonementov/operation/api.loyalty.abonement_types.state_modification) Архивация/восстановление типа абонемента

patch/chain/{chain\_id}/loyalty/abonement\_types/{loyalty\_abonement\_type\_id}

https://api.yclients.com/api/v1/chain/{chain\_id}/loyalty/abonement\_types/{loyalty\_abonement\_type\_id}

Используется для архивации/разархивации типа абонемента.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| chain\_id<br>required | number<br>Example:123<br>Идентификатор сети. |
| abonement\_type\_id<br>required | integer<br>Example:34<br>Идентификатор типа абонемента. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

##### Request Body schema: application/json

|     |     |
| --- | --- |
| is\_archived<br>required | boolean<br>Признак архивации абонемента. (true - заархивирован, false - не заархивирован). |

### Responses

**204**
No Content

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Request samples

- Payload

Content type

application/json

Copy

`{
"is_archived": true}`

### Response samples

- 401
- 403
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": false,
"data": null,
"meta": {
"message": "Необходима авторизация"}}`

## [tag/Tipy-abonementov/operation/api.loyalty.abonement_types.clone](https://developers.yclients.com/ru/\#tag/Tipy-abonementov/operation/api.loyalty.abonement_types.clone) Клонирование типа абонемента по идентификатору

post/chain/{chain\_id}/loyalty/abonement\_types/{loyalty\_abonement\_type\_id}/clone

https://api.yclients.com/api/v1/chain/{chain\_id}/loyalty/abonement\_types/{loyalty\_abonement\_type\_id}/clone

Клонирует тип абонемента по идентификатору.

##### Authorizations:

_BearerPartnerUser_

##### path Parameters

|     |     |
| --- | --- |
| chain\_id<br>required | number<br>Example:123<br>Идентификатор сети. |
| abonement\_type\_id<br>required | integer<br>Example:34<br>Идентификатор типа абонемента. |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>Example:application/vnd.yclients.v2+json<br>Должен быть равен `application/vnd.yclients.v2+json` |
| Content-Type<br>required | string<br>Example:application/json<br>Должен быть равен `application/json` |

##### Request Body schema: application/json

_Schema not provided_

### Responses

**201**
Created

##### Response Schema: application/json

|     |     |
| --- | --- |
| id | number<br>Идентификатор типа абонемента. |
| salon\_group\_id | number<br>Идентификатор сети, в которой действует тип абонемента. |
| title | string<br>Название типа абонементы. |
| period | number<br>Срок действия абонемента (0, если не задан). |
| period\_unit\_id | number<br>Единица измерения срока действия абонемента (1 - день, 2 - неделя, 3 - месяц, 4 - год, если не задан - 0). |
| allow\_freeze | boolean<br>Допускается ли заморозка абонементов: true - допускается, false - не допускается. |
| freeze\_limit | number<br>Максимальный общий период заморозки. |
| freeze\_limit\_unit\_id | number<br>Единица измерения срока заморозки абонемента (1 - день, 2 - неделя, 3 - месяц, 4 - год). |
| is\_allow\_empty\_code | boolean<br>Разрешить продажу абонемента без кода: true - разрешить, false - не разрешать. |
| is\_united\_balance | boolean<br>Общий или раздельный баланс абонемента: true - общий, false - раздельный. |
| cost | number<br>Цена абонемента. |
| expiration\_type\_id | number<br>Тип активации абонемента (1 - при продаже, 2 - при первом использовании, 3 - с конкретной даты). |
| is\_online\_sale\_enabled | boolean<br>Онлайн продажа (true - разрешена, false - запрещена). |
| online\_sale\_title | string<br>Название абонемента при онлайн продаже. |
| online\_sale\_description | string<br>Описание абонемента при онлайн продаже. |
| online\_sale\_price | number<br>Цена абонемента при продаже онлайн. |
| service\_price\_correction | boolean<br>Возможность корректировки цены услуги при применении абонемента. |
| united\_balance\_services\_count | number<br>Количество посещений для общего баланса. |
| autoactivation\_time | number<br>Кол-во единиц времени для автоактивации абонемента. |
| autoactivation\_time\_unit\_id | integer<br>Единицы измерения для автоактивации (1 - дни, 2 - недели, 3 - месяцы, 4 - годы). |
| attached\_salon\_ids | Array of numbers<br>Список ID прикреплённых к типу абонемента филиалов. |
| online\_sale\_image | string<br>Ссылка на изображение при онлайн продаже. |
| availability | Array of objects (Объект модели "Период доступности абонемента".) <br>Список условий доступности абонемента. |
| balance\_container | object (Объект модели "Баланс абонемента".) <br>Объект с массивом прикрепленных услуг и/или категорий и их балансом. |

**401**
Unauthorized

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**403**
Forbidden

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке запроса) <br>Дополнительная информация о запросе. |

**404**
Not Found

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Пустой объект дополнительной информации о запросе) <br>Дополнительная информация о запросе. |

**422**
Unprocessable Entity

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean (Неуспешный статус запроса) <br>Статус запроса. |
| data | object or null (Отсутствие данных по запросу) <br>Данные по запросу. |
| meta | object (Сообщение об ошибке валидации данных запроса) <br>Дополнительная информация о запросе. |

### Response samples

- 201
- 401
- 403
- 404
- 422

Content type

application/json

Copy
Expand all  Collapse all

`{
"id": 777,
"salon_group_id": 333,
"title": "Абонемент на 10 посещений",
"period": 10,
"period_unit_id": 1,
"allow_freeze": true,
"freeze_limit": 30,
"freeze_limit_unit_id": 1,
"is_allow_empty_code": false,
"is_united_balance": true,
"cost": 1000,
"expiration_type_id": 1,
"is_online_sale_enabled": false,
"online_sale_title": "Абонемент на 10 посещений",
"online_sale_description": "Продается онлайн со скидкой",
"online_sale_price": 550,
"service_price_correction": true,
"united_balance_services_count": 10,
"autoactivation_time": 10,
"autoactivation_time_unit_id": 1,
"attached_salon_ids": [\
1,\
2,\
3],
"online_sale_image": "https://yclients.com/images/abonement_type.png",
"availability": [\
{\
"week_days": [\
1,\
2,\
3],\
"intervals": [\
{\
"from": 3600,\
"to": 7200},\
{\
"from": 10800,\
"to": 14400}]},\
{\
"week_days": [\
6,\
7],\
"intervals": [\
{\
"from": 36000,\
"to": 72000}]}],
"balance_container": {
"links": [\
{\
"count": 10,\
"service": {\
"id": 45,\
"is_category": false,\
"category_id": 90,\
"category": {\
"id": 90,\
"is_category": true,\
"category_id": 1,\
"title": "Первая категория услуг в филиале"},\
"title": "Услуга в филиале"}},\
{\
"count": 15,\
"category": {\
"id": 91,\
"is_category": true,\
"category_id": 1,\
"title": "Вторая категория услуг в филиале"}}]}}`

# [tag/Chaevye](https://developers.yclients.com/ru/\#tag/Chaevye) Чаевые

## [tag/Chaevye/paths/~1tips~1{company_id}~1settings/get](https://developers.yclients.com/ru/\#tag/Chaevye/paths/~1tips~1{company_id}~1settings/get) Получить список мастеров салона с их настройками чаевых

get/tips/{company\_id}/settings

https://api.yclients.com/api/v1/tips/{company\_id}/settings

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | integer<br>id салона |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
Коллекция объектов

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | object<br>Метаданные (содержит количество найденных мастеров) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 3120,\
"location_id": 4564,\
"staff_id": 1071804,\
"hash": "1a27116c-726d-4cec-a7dd-7bd6d669a8c1",\
"status": 1,\
"status_title": "новые настройки",\
"is_enabled": false,\
"landing_external": "https://u7.dev.yclients.tech/tips/external/4564/1a27116c-726d-4cec-a7dd-7bd6d669a8c1/",\
"staff": {\
"id": 1071804,\
"name": "Отзывы филиал Бизнес образец",\
"specialization": "Отзывы"}},\
{\
"id": 1,\
"location_id": 4564,\
"staff_id": 37695,\
"hash": "abf52f53-e94c-41e8-9f76-93485fd76e5e",\
"status": 1,\
"status_title": "новые настройки",\
"is_enabled": false,\
"landing_external": "https://u7.dev.yclients.tech/tips/external/4564/abf52f53-e94c-41e8-9f76-93485fd76e5e/",\
"staff": {\
"id": 37695,\
"name": "Ким Кардашьян",\
"specialization": "Косметолог-визажист",\
"user": {\
"id": 746310,\
"name": "Андрей Панов",\
"email": "a.panov@yclients.com",\
"phone": "79999820966"},\
"position": {\
"id": 452,\
"title": "Массажист"}}}]}`

## [tag/Chaevye/paths/~1tips~1{company_id}~1settings~1{master_tips_settings_id}~1enable/get](https://developers.yclients.com/ru/\#tag/Chaevye/paths/~1tips~1{company_id}~1settings~1{master_tips_settings_id}~1enable/get) Включить чаевые у мастера

get/tips/{company\_id}/settings/{master\_tips\_settings\_id}/enable

https://api.yclients.com/api/v1/tips/{company\_id}/settings/{master\_tips\_settings\_id}/enable

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| master\_tips\_settings\_id<br>required | integer<br>id настроек чаевых |
| company\_id<br>required | number<br>Идентификатор компании |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
Объект настроек чаевых

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | object<br>Метаданные (содержит количество найденных мастеров) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 1,\
"location_id": 253859,\
"staff_id": 742418,\
"hash": "ba816199-eecf-4bd2-9f1d-db470545bfaf",\
"status": 3,\
"status_title": "ожидание аккаунта",\
"is_enabled": true,\
"landing_external": "https://yclients.com/tips/external/253859/ba816199-eecf-4bd2-9f1d-db470545bfaf/",\
"master_tips_form_link": "https://yclients.com/companies/253859/staff/742418/tips/pay/",\
"invite_sms_sent": false,\
"staff": {\
"id": 742418,\
"name": "Фуса",\
"specialization": "специалист",\
"avatar": "https://assets.yclients.com/masters/sm/c/c7/c77a4bf2b6b3896_20210304004333.png",\
"employee": {\
"id": 733043,\
"phone": ""},\
"user": {\
"id": 1553930,\
"name": "Дмитрий Иванов",\
"email": "ivanov@yclients.tech",\
"phone": "79774510087"},\
"position": {\
"id": 103883,\
"title": "Йогист"}}},\
{\
"id": 152763,\
"location_id": 253859,\
"staff_id": 743018,\
"hash": "b7c81cab-290a-4b0a-ad05-9c4b98ef3565",\
"status": 4,\
"status_title": "всё настроено",\
"is_enabled": true,\
"landing_external": "https://yclients.com/tips/external/253859/b7c81cab-290a-4b0a-ad05-9c4b98ef3565/",\
"master_tips_form_link": "https://yclients.com/companies/253859/staff/743018/tips/pay/",\
"invite_sms_sent": false,\
"staff": {\
"id": 743018,\
"name": "Наташа М",\
"specialization": "маникюрщица",\
"avatar": "https://api.yclients.com/images/no-master-sm.png",\
"employee": {\
"id": 733547,\
"phone": ""},\
"user": {\
"id": 6259059,\
"name": "Наташа М",\
"email": "qwerty@yclients.com",\
"phone": "71234565748"},\
"position": {\
"id": 103731,\
"title": "Мастер маникюра"}}}],
"meta": {
"count": 2}}`

## [tag/Chaevye/paths/~1tips~1{company_id}~1settings~1{master_tips_settings_id}~1disable/post](https://developers.yclients.com/ru/\#tag/Chaevye/paths/~1tips~1{company_id}~1settings~1{master_tips_settings_id}~1disable/post) Отключить чаевые у мастера

post/tips/{company\_id}/settings/{master\_tips\_settings\_id}/disable

https://api.yclients.com/api/v1/tips/{company\_id}/settings/{master\_tips\_settings\_id}/disable

##### Authorizations:

(_bearer__user_)

##### path Parameters

|     |     |
| --- | --- |
| company\_id<br>required | integer<br>id салона |
| master\_tips\_settings\_id<br>required | integer<br>id настроек чаевых |

##### header Parameters

|     |     |
| --- | --- |
| Accept<br>required | string<br>application/vnd.yclients.v2+json |
| Content-Type<br>required | string<br>application/json |
| Authorization<br>required | string<br>Bearer partner\_token, User user\_token |

### Responses

**200**
Объект настроек чаевых

##### Response Schema: application/json

|     |     |
| --- | --- |
| success | boolean<br>Статус успешности выполнения (true) |
| data | Array of objects<br>Массив объектов с данными |
| meta | object<br>Метаданные (содержит количество найденных мастеров) |

### Response samples

- 200

Content type

application/json

Copy
Expand all  Collapse all

`{
"success": true,
"data": [\
{\
"id": 1,\
"location_id": 253859,\
"staff_id": 742418,\
"hash": "ba816199-eecf-4bd2-9f1d-db470545bfaf",\
"status": 3,\
"status_title": "ожидание аккаунта",\
"is_enabled": true,\
"landing_external": "https://yclients.com/tips/external/253859/ba816199-eecf-4bd2-9f1d-db470545bfaf/",\
"master_tips_form_link": "https://yclients.com/companies/253859/staff/742418/tips/pay/",\
"invite_sms_sent": false,\
"staff": {\
"id": 742418,\
"name": "Фуса",\
"specialization": "специалист",\
"avatar": "https://assets.yclients.com/masters/sm/c/c7/c77a4bf2b6b3896_20210304004333.png",\
"employee": {\
"id": 733043,\
"phone": ""},\
"user": {\
"id": 1553930,\
"name": "Дмитрий Иванов",\
"email": "ivanov@yclients.tech",\
"phone": "79774510087"},\
"position": {\
"id": 103883,\
"title": "Йогист"}}},\
{\
"id": 152763,\
"location_id": 253859,\
"staff_id": 743018,\
"hash": "b7c81cab-290a-4b0a-ad05-9c4b98ef3565",\
"status": 4,\
"status_title": "всё настроено",\
"is_enabled": true,\
"landing_external": "https://yclients.com/tips/external/253859/b7c81cab-290a-4b0a-ad05-9c4b98ef3565/",\
"master_tips_form_link": "https://yclients.com/companies/253859/staff/743018/tips/pay/",\
"invite_sms_sent": false,\
"staff": {\
"id": 743018,\
"name": "Наташа М",\
"specialization": "маникюрщица",\
"avatar": "https://api.yclients.com/images/no-master-sm.png",\
"employee": {\
"id": 733547,\
"phone": ""},\
"user": {\
"id": 6259059,\
"name": "Наташа М",\
"email": "qwerty@yclients.com",\
"phone": "71234565748"},\
"position": {\
"id": 103731,\
"title": "Мастер маникюра"}}}],
"meta": {
"count": 2}}`