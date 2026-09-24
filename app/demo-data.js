// Демо-данные из прототипа. Загружаются только при первом запуске,
// пока на компьютере ещё нет сохранённой базы (или после «Сбросить к демо-данным»).
window.CRM_DEMO_DATA = {
  managers: ["Олег Копылевич","Аня Сулейманова","Саша Атанов","Максим Баранчук","Локшина Рита"],

  bases: [
    {id:'b1', year:2026, direction:'БФ', date:'27.03.2026', name:'27.03.Умные финансы: ИИ в БИТ.Финанс для роста и контроля крупных компаний 27.03'},
    {id:'b2', year:2026, direction:'БФ', date:'30.06.2026', name:'30.06 Финансовая устойчивость в строительстве: как обеспечить рост'}
  ],

  companies: [
    {id:'c1', baseId:'b1', name:'ООО «АТЭС»', inn:'7729512345', contact:'', position:'', phone:'', email:'', k7:'', statusWebinar:'', statusReg:'', statusConfirm:'', manager:'Аня Сулейманова', calls:[]},
    {id:'c2', baseId:'b1', name:'ООО «Миньярский карьер»', inn:'7415098234', contact:'', position:'', phone:'', email:'', k7:'', statusWebinar:'', statusReg:'', statusConfirm:'', manager:'Аня Сулейманова', calls:[]},
    {id:'c3', baseId:'b1', name:'ООО «ТК Северный проект»', inn:'2721004521', contact:'', position:'', phone:'', email:'', k7:'', statusWebinar:'', statusReg:'', statusConfirm:'', manager:'Аня Сулейманова', calls:[
      {date:'26.03.2026 12:05', who:'Аня Сулейманова', result:'В проработке', comment:'Нужно согласовать с финдиром', callback:'', duration:185}
    ]},
    {id:'c4', baseId:'b1', name:'ПИР ООО', inn:'7801234567', contact:'', position:'', phone:'', email:'', k7:'', statusWebinar:'', statusReg:'', statusConfirm:'', manager:'Аня Сулейманова', calls:[]},
    {id:'c5', baseId:'b1', name:'ООО «РТЛ»', inn:'7743098761', contact:'', position:'', phone:'', email:'', k7:'099/00038671', statusWebinar:'Не пришёл', statusReg:'', statusConfirm:'', manager:'Олег Копылевич', calls:[
      {date:'26.03.2026 11:20', who:'Олег Копылевич', result:'Недозвон', comment:'', callback:'28.03.2026', duration:12}
    ]},
    {id:'c6', baseId:'b1', name:'ООО «Шанс Трейд»', inn:'6312045871', contact:'', position:'', phone:'', email:'', k7:'099/00038679', statusWebinar:'Не пришёл', statusReg:'', statusConfirm:'', manager:'Олег Копылевич', calls:[]},
    {id:'c7', baseId:'b1', name:'АО «Отисифарм»', inn:'7702235123', contact:'', position:'', phone:'', email:'', k7:'099/00038653', statusWebinar:'Не пришёл', statusReg:'', statusConfirm:'', manager:'Олег Копылевич', calls:[
      {date:'25.03.2026 09:40', who:'Олег Копылевич', result:'Неинтересно', comment:'Отказ, работают с другим подрядчиком', callback:'', duration:48}
    ]},
    {id:'c8', baseId:'b2', name:'ООО «ТРИА СТРОЙ»', inn:'7713445372', contact:'Кирилл Владимирович', position:'Финансовый директор', phone:'+7 (905) 530-88-99', email:'k.vladimirovich@triastroy.ru', k7:'087/0002673', statusWebinar:'Не пришёл', statusReg:'Зарегистрирован', statusConfirm:'Подтвердил', manager:'Саша Атанов', calls:[
      {date:'24.06.2026 14:02', who:'Павельева Лариса', result:'Зарегистрирован на вебинар', comment:'milashevskaya_l@mail.ru', callback:'', duration:95},
      {date:'30.06.2026 20:39', who:'Саша Атанов', result:'—', comment:'', callback:'', duration:9},
      {date:'10.07.2026 18:11', who:'Саша Атанов', result:'Обсуждаем возможность встречи', comment:'Любовь, бухгалтер — возможно в будущем будет задействована в вопросах финучёта', callback:'17.07.2026', duration:276}
    ]},
    {id:'c9', baseId:'b2', name:'ООО «Лямбда»', inn:'5029087612', contact:'', position:'', phone:'', email:'', k7:'', statusWebinar:'', statusReg:'', statusConfirm:'', manager:'Максим Баранчук', calls:[]},
    {id:'c10', baseId:'b2', name:'АО «Мосгаз»', inn:'7701234560', contact:'', position:'', phone:'', email:'', k7:'', statusWebinar:'', statusReg:'', statusConfirm:'', manager:'Локшина Рита', calls:[
      {date:'02.07.2026 15:10', who:'Локшина Рита', result:'Перезвонить', comment:'Просили перенести разговор на после отпуска', callback:'20.07.2026', duration:63}
    ]}
  ],

  deals: [
    {id:'d1', companyId:'c8', adhocName:'', stage:'discuss', amount:350000, probability:40, expectedDate:'', owner:'Саша Атанов',
      comments:[{date:'10.07.2026 18:15', who:'Саша Атанов', text:'Любовь просила прислать презентацию решения по финучёту, до встречи ещё не договорились'}],
      tasks:[{id:'t1', text:'Отправить презентацию по БИТ.Финанс', assignee:'Саша Атанов', due:'2026-07-20', stage:'discuss', done:false}]},
    {id:'d2', companyId:null, adhocName:'ООО «Стройтех-Юг»', adhocContact:'Виктор Наумов', adhocPosition:'Директор', adhocPhone:'+7 (912) 340-17-25', adhocEmail:'naumov@stroytech-yug.ru', stage:'scheduled', amount:620000, probability:55, expectedDate:'2026-08-05', owner:'Максим Баранчук',
      comments:[], tasks:[
        {id:'t2', text:'Подготовить КП к встрече', assignee:'Максим Баранчук', due:'2026-08-01', stage:'scheduled', done:false},
        {id:'t3', text:'Уточнить состав участников встречи', assignee:'Максим Баранчук', due:'', stage:'scheduled', done:true}
      ]},
    {id:'d3', companyId:null, adhocName:'АО «Вектор Логистик»', adhocContact:'Марина Гусева', adhocPosition:'Коммерческий директор', adhocPhone:'+7 (903) 271-64-08', adhocEmail:'guseva@vectorlog.ru', stage:'met', amount:890000, probability:65, expectedDate:'2026-08-20', owner:'Аня Сулейманова',
      comments:[{date:'02.07.2026 10:00', who:'Аня Сулейманова', text:'Встреча прошла хорошо, ждём согласования бюджета от финдира'}],
      tasks:[{id:'t4', text:'Согласовать бюджет с финдиром клиента', assignee:'Аня Сулейманова', due:'2026-07-25', stage:'met', done:false}]},
    {id:'d4', companyId:null, adhocName:'ООО «Промресурс»', adhocContact:'Дмитрий Ковалёв', adhocPosition:'Главный бухгалтер', adhocPhone:'+7 (926) 558-90-12', adhocEmail:'kovalev@promresurs.ru', stage:'invoiced', amount:410000, probability:80, expectedDate:'2026-07-30', owner:'Олег Копылевич',
      comments:[], tasks:[{id:'t5', text:'Проконтролировать оплату счёта', assignee:'Олег Копылевич', due:'2026-07-29', stage:'invoiced', done:false}]},
    {id:'d5', companyId:null, adhocName:'ООО «Кабель Плюс»', adhocContact:'Светлана Орлова', adhocPosition:'Директор', adhocPhone:'+7 (985) 402-77-31', adhocEmail:'orlova@kabelplus.ru', stage:'won', amount:275000, probability:100, expectedDate:'2026-07-10', owner:'Локшина Рита',
      comments:[{date:'10.07.2026 09:00', who:'Локшина Рита', text:'Оплата прошла, проект передаём в разработку'}], tasks:[]},
    {id:'d6', companyId:null, adhocName:'ЗАО «Термо Инвест»', adhocContact:'Игорь Малышев', adhocPosition:'Снабженец', adhocPhone:'+7 (916) 630-45-19', adhocEmail:'malyshev@termoinvest.ru', stage:'lost', amount:500000, probability:0, expectedDate:'', owner:'Олег Копылевич',
      comments:[{date:'28.06.2026 16:40', who:'Олег Копылевич', text:'Выбрали другого подрядчика по цене'}], tasks:[]}
  ]
};
