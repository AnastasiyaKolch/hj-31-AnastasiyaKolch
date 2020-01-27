'use strict';

const urlApi = 'https://neto-api.herokuapp.com';
const urlWss = 'wss://neto-api.herokuapp.com/pic';

const errorMoreDrag = 'Чтобы загрузить новое изображение, пожалуйста, воспользуйтесь пунктом "Загрузить новое" в меню';
const commentsWrap = document.createElement('div');
const canvas = document.createElement('canvas');
const currentImage = document.querySelector('.current-image');
const loader = document.querySelector('.image-loader');
const wrapApp = document.querySelector('.app');
const formComment = document.querySelector('.comments__form').cloneNode(true);

let connection;
let dataGetParse;
let showComments = {};
let currColor;
let url = new URL(`${window.location.href}`);
let paramId = url.searchParams.get('id');

//глобальные переменные
letInstall('error');
letInstall('menu');
letInstall('burger');

// --------------Публикация-----------
currentImage.src = ''; // убираем фон

// убираем пункты меню для режима "Публикации"
letInitial('menu').dataset.state = 'initial';
wrapApp.dataset.state = '';
cover(letInitial('burger'));

// убираем комментарии
wrapApp.removeChild(document.querySelector('.comments__form'));

//открываем окно выбора файла для загрузки
letInitial('menu').querySelector('.new').addEventListener('click', uploadFileFromInput);

//загрузка файла drag&drop
wrapApp.addEventListener('drop', eventFileDrop);
wrapApp.addEventListener('dragover', event => event.preventDefault());

//показать меню
letInitial('burger').addEventListener('click', showMenu);

//создаem форму для комментариев при клике
canvas.addEventListener('click', checkComment);

//Показывать комментарии
document.querySelector('.menu__toggle-title_on').addEventListener('click', markCheckboxOn);
document.querySelector('#comments-on').addEventListener('click', markCheckboxOn);

//Скрыть комментарии
document.querySelector('.menu__toggle-title_off').addEventListener('click', markCheckboxOff);
document.querySelector('#comments-off').addEventListener('click', markCheckboxOff);

// копируем ссылку
letInitial('menu').querySelector('.menu_copy').addEventListener('click', replicate);
urlId(paramId); // Получаем из ссылки параметр id

Array.from(letInitial('menu').querySelectorAll('.menu__color')).forEach(color => {
    if (color.checked) {
        currColor = getComputedStyle(color.nextElementSibling).backgroundColor;
    }
    color.addEventListener('click', (event) => { //при клике на элемент, получим цвет 
        currColor = getComputedStyle(event.currentTarget.nextElementSibling).backgroundColor;
    });
});

// переменные для рисования
const ctx = canvas.getContext('2d');
const BRUSH_RADIUS = 4;
let curves = [];
let drawing = false;
let needsRepaint = false;

//События
canvas.addEventListener('mousedown', (event) => {
    if (!(letInitial('menu').querySelector('.draw').dataset.state === 'selected')) return;
    drawing = true;

    const curve = [];
    curve.color = currColor;
    curve.push(makePoint(event.offsetX, event.offsetY));
    curves.push(curve);
    needsRepaint = true;
});

canvas.addEventListener('mouseup', (event) => {
    letInitial('menu').style.zIndex = '1';
    drawing = false;
});

canvas.addEventListener('mouseleave', (event) => {
    drawing = false;
});

canvas.addEventListener('mousemove', (event) => {
    if (drawing) {
        letInitial('menu').style.zIndex = '0';
        curves[curves.length - 1].push(makePoint(event.offsetX, event.offsetY));
        needsRepaint = true;
        debounceSendMask();
    }
});

const debounceSendMask = debounce(sendMaskState, 1000);

tick();

// Инициализация хранилища
function initialGlobalStorage() {
    if (typeof(window['globalStorage']) === 'undefined') {
        window.globalStorage = {};
    }

    return window.globalStorage;
}

// Устанавливаем переменную в хранилище
function letInstall(arg) {
    let storage = initialGlobalStorage();

    storage[arg] = document.querySelector(`.${arg}`);
}

// Получить значение переменной из хранилища
function letInitial(arg) {
    let storage = initialGlobalStorage();

    return storage[arg];
}

//Копируем ссылку из пункта меню "Поделиться"
function replicate() {
    letInitial('menu').querySelector('.menu__url').select();
    try {
        let successful = document.execCommand('copy');
        let msg = successful ? 'успешно ' : 'не';
        console.log(`URL ${msg} скопирован`);
    } catch (err) {
        console.log('Ошибка копирования');
    }
    window.getSelection().removeAllRanges();
}

// Убираем расширение файла
function delExtension(inputText) {
    let regExp = new RegExp(/\.[^.]+$/gi);
    return inputText.replace(regExp, '');
}

// разбивка timestamp в строку для отображения времени
function dataTime(timestamp) {
    const options = {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    };
    const date = new Date(timestamp);
    const dateStr = date.toLocaleString('ru-RU', options);

    return dateStr.slice(0, 8) + dateStr.slice(9);
}

// Скрываем текст ошибки через 5 сек.
function errorRemove() {
    setTimeout(function() {
        cover(letInitial('error'))
    }, 5000);
}

// Скрываем элементы
function cover(el) {
    el.style.display = 'none';
}

// Показываем элементы
function showElement(el) {
    el.style.display = '';
}

// drag
document.addEventListener('mousedown', dragStart);
document.addEventListener('mousemove', throttle(drag));
document.addEventListener('mouseup', drop);

let movedPiece = null;
let minY, minX, maxX, maxY;
let shiftX = 0;
let shiftY = 0;


function dragStart(event) {
    if (!event.target.classList.contains('drag')) { return; }

    movedPiece = event.target.parentElement;
    minX = wrapApp.offsetLeft;
    minY = wrapApp.offsetTop;

    maxX = wrapApp.offsetLeft + wrapApp.offsetWidth - movedPiece.offsetWidth;
    maxY = wrapApp.offsetTop + wrapApp.offsetHeight - movedPiece.offsetHeight;

    shiftX = event.pageX - event.target.getBoundingClientRect().left - window.pageXOffset;
    shiftY = event.pageY - event.target.getBoundingClientRect().top - window.pageYOffset;
}

// перемещаем меню в соответствии с движением мыши, учитываем ограничения
function drag(event) {
    if (!movedPiece) { return; }

    let x = event.pageX - shiftX;
    let y = event.pageY - shiftY;
    x = Math.min(x, maxX);
    y = Math.min(y, maxY);
    x = Math.max(x, minX);
    y = Math.max(y, minY);
    movedPiece.style.left = x + 'px';
    movedPiece.style.top = y + 'px';
}

// заканчиваем движение меню
function drop(event) {
    if (movedPiece) {
        movedPiece = null;
    }
}

// используется для ограничения частоты срабатывания функции drag
function throttle(callback) {
    let isWaiting = false;
    return function(...rest) {
        if (!isWaiting) {
            callback.apply(this, rest);
            isWaiting = true;
            requestAnimationFrame(() => {
                isWaiting = false;
            });
        }
    };
}

// отложенный запуск функции, после завершения события
function debounce(func, delay = 0) {
    let timeout;

    return () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            timeout = null;
            func();
        }, delay);
    };
}


function uploadFileFromInput(event) {
    cover(letInitial('error'));
    //форма для выбора файла
    const input = document.createElement('input');
    input.setAttribute('id', 'fileInput');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/jpeg, image/png');
    cover(input);
    letInitial('menu').appendChild(input);

    document.querySelector('#fileInput').addEventListener('change', event => {
        const files = Array.from(event.currentTarget.files);

        if (currentImage.dataset.load === 'load') {
            removeForm();
            curves = [];
        }

        sendFile(files);
    });

    input.click();
    letInitial('menu').removeChild(input);
}

// drag & drop изображения для загрузки
function eventFileDrop(event) {
    event.preventDefault();
    cover(letInitial('error'));
    const files = Array.from(event.dataTransfer.files);

    if (currentImage.dataset.load === 'load') {
        showElement(letInitial('error'));
        letInitial('error').lastElementChild.textContent = errorMoreDrag;
        errorRemove();
        return;
    }

    files.forEach(file => {
        if ((file.type === 'image/jpeg') || (file.type === 'image/png')) {
            sendFile(files);
        } else {
            showElement(letInitial('error'))
        }
    });
}

// загрузка изображения на сервер
function sendFile(files) {
    const formData = new FormData();

    files.forEach(file => {
        const fileTitle = delExtension(file.name);
        formData.append('title', fileTitle);
        formData.append('image', file);
    });

    showElement(loader);

    fetch(`${urlApi}/pic`, {
            body: formData,
            credentials: 'same-origin',
            method: 'POST'
        })
        .then(res => {
            if (res.status >= 200 && res.status < 300) {
                return res;
            }
            throw new Error(res.statusText);
        })
        .then(res => res.json())
        .then(res => {
            setReview(res.id);
        })
        .catch(er => {
            console.log(er);
            cover(loader);
        });

}

// удаление форм комментариев, при загрузке нового изображения
function removeForm() {
    const formComment = wrapApp.querySelectorAll('.comments__form');
    Array.from(formComment).forEach(item => { item.remove() });
}

// получаем информацию о файле
function setReview(id) {
    const xhrGetInfo = new XMLHttpRequest();
    xhrGetInfo.open(
        'GET',
        `${urlApi}/pic/${id}`,
        false
    );
    xhrGetInfo.send();

    dataGetParse = JSON.parse(xhrGetInfo.responseText);
    localStorage.host = `${window.location.origin}${window.location.pathname}?id=${dataGetParse.id}`;

    wss();
    setcurrentImage(dataGetParse);
    letInitial('burger').style.cssText = ``;
    showMenu();
    let link = localStorage.host;
    history.pushState(null, null, link);

    currentImage.addEventListener('load', () => {
        cover(loader);
        createWrapforCanvasComment();
        createCanvas();
        currentImage.dataset.load = 'load';
    });
    updateCommentForm(dataGetParse.comments);
}

// раскрытие пунктов меню
function showMenu() {
    letInitial('menu').dataset.state = 'default';

    Array.from(letInitial('menu').querySelectorAll('.mode')).forEach(modeItem => {
        modeItem.dataset.state = '';
        modeItem.addEventListener('click', () => {

            if (!modeItem.classList.contains('new')) {
                letInitial('menu').dataset.state = 'selected';
                modeItem.dataset.state = 'selected';
            }

            if (modeItem.classList.contains('share')) {
                letInitial('menu').querySelector('.menu__url').value = localStorage.host;
            }
        })
    })
}

// показывать меню "Комментарии"
function showMenuComments() {
    letInitial('menu').dataset.state = 'default';

    Array.from(letInitial('menu').querySelectorAll('.mode')).forEach(modeItem => {
        if (!modeItem.classList.contains('comments')) { return; }

        letInitial('menu').dataset.state = 'selected';
        modeItem.dataset.state = 'selected';
    })
}

// добавить фон 
function setcurrentImage(fileInfo) {
    currentImage.src = fileInfo.url;
}

//скрыть комментарии
function markCheckboxOff() {
    const forms = document.querySelectorAll('.comments__form');
    Array.from(forms).forEach(form => {
        form.style.display = 'none';
    })
}

//показать комментарии
function markCheckboxOn() {
    const forms = document.querySelectorAll('.comments__form');
    Array.from(forms).forEach(form => {
        form.style.display = '';
    })
}

// создание нового комментария при клике на холсте
function checkComment(event) {
    // проверяем, что включен режим "Комментирование" и стоит галочка "Показывать комментарии"
    if (!(letInitial('menu').querySelector('.comments').dataset.state === 'selected') || !wrapApp.querySelector('#comments-on').checked) { return; }
    commentsWrap.appendChild(createCommentForm(event.offsetX, event.offsetY));
}

// задаем все атрибуты холста и вставляем его в DOM
function createCanvas() {
    const width = getComputedStyle(wrapApp.querySelector('.current-image')).width.slice(0, -2);
    const height = getComputedStyle(wrapApp.querySelector('.current-image')).height.slice(0, -2);
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.display = 'block';
    canvas.style.zIndex = '1';
    commentsWrap.appendChild(canvas);
}

//создаем div, в который будем помещать комментарии,чтобы их координаты можно было зафиксировать относительно этого div, а не документа, чтобы комментарии не съезжали при изменении окна браузера
function createWrapforCanvasComment() {
    const width = getComputedStyle(wrapApp.querySelector('.current-image')).width;
    const height = getComputedStyle(wrapApp.querySelector('.current-image')).height;
    commentsWrap.style.cssText = `
		width: ${width};
		height: ${height};
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		display: '';
	`;
    wrapApp.appendChild(commentsWrap);

    // отображение комментария поверх других
    commentsWrap.addEventListener('click', event => {
        if (event.target.closest('form.comments__form')) {
            Array.from(commentsWrap.querySelectorAll('form.comments__form')).forEach(form => {
                form.style.zIndex = 2;
            });
            event.target.closest('form.comments__form').style.zIndex = 3;
        }
    });
}

//при создании новой формы для комментария, удаляем все пустые 
function removeEmptyForms() {
    const forms = document.querySelectorAll('.comments__form');
    forms.forEach(form => {
        if (!form.querySelector('.comment:not(.comment__loader)') && form.querySelector('.comment__loader').style.display === 'none') {
            form.remove();
        }
    });
}

// сворачиваем формы с добавленными комментариями, присоздании новой формы
function closeAllForms() {
    const checkboxes = document.querySelectorAll('.comments__marker-checkbox');
    checkboxes.forEach(checkboxes => checkboxes.checked = false);
}

//Форма для комментариев
function createCommentForm(x, y) {
    removeEmptyForms();
    closeAllForms();
    const formComment = document.createElement('form');
    formComment.style.display = '';
    formComment.style.zIndex = 10;
    formComment.classList.add('comments__form');
    formComment.innerHTML = `
		<span class="comments__marker"></span><input type="checkbox" checked class="comments__marker-checkbox">
		<div class="comments__body">
			<div class="comment comment__loader">
				<div class="loader">
					<span></span>
					<span></span>
					<span></span>
					<span></span>
					<span></span>
				</div>
			</div>
			<textarea class="comments__input" type="text" placeholder="Напишите ответ..."></textarea>
			<input class="comments__close" type="button" value="Закрыть">
			<input class="comments__submit" type="submit" value="Отправить">
        </div>`;

    //отображение маркера,там где кликнули
    const left = x - 22;
    const top = y - 14;

    formComment.style.cssText = `
		top: ${top}px;
		left: ${left}px;
        z-index: 2; 
        display: ''
	`;
    formComment.dataset.left = left;
    formComment.dataset.top = top;

    cover(formComment.querySelector('.loader').parentElement);

    // кнопка закрыть
    formComment.querySelector('.comments__close').addEventListener('click', () => {
        formComment.querySelector('.comments__marker-checkbox').checked = false;
    });

    //кнопка отправить
    formComment.addEventListener('submit', messageSend);
    formComment.querySelector('.comments__input').addEventListener('keydown', keySendMessage);

    // Отправляем комментарий по нажатию Ctrl + Enter
    function keySendMessage(event) {
        if (event.repeat) { return; }
        if (!event.ctrlKey) { return; }

        switch (event.code) {
            case 'Enter':
                messageSend();
                break;
        }
    }

    function messageSend(event) {
        if (event) {
            event.preventDefault();
        }
        const message = formComment.querySelector('.comments__input').value;
        const messageSend = `message=${encodeURIComponent(message)}&left=${encodeURIComponent(left)}&top=${encodeURIComponent(top)}`;
        commentsSend(messageSend);
        showElement(formComment.querySelector('.loader').parentElement);
        formComment.querySelector('.comments__input').value = '';
    }

    function commentsSend(message) {
        fetch(`${urlApi}/pic/${dataGetParse.id}/comments`, {
                method: 'POST',
                body: message,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
            })
            .then(res => {
                if (res.status >= 200 && res.status < 300) {
                    return res;
                }
                throw new Error(res.statusText);
            })
            .then(res => res.json())
            .catch(er => {
                console.log(er);
                formComment.querySelector('.loader').parentElement.style.display = 'none';
            });
    }

    return formComment;
}

//Добавление комментария в форму
function addMessageComment(message, form) {
    let parentLoaderDiv = form.querySelector('.loader').parentElement;

    const newMessageDiv = document.createElement('div');
    newMessageDiv.classList.add('comment');
    newMessageDiv.dataset.timestamp = message.timestamp;

    const commentTimeP = document.createElement('p');
    commentTimeP.classList.add('comment__time');
    commentTimeP.textContent = dataTime(message.timestamp);
    newMessageDiv.appendChild(commentTimeP);

    const commentMessageP = document.createElement('p');
    commentMessageP.classList.add('comment__message');
    commentMessageP.textContent = message.message;
    newMessageDiv.appendChild(commentMessageP);

    form.querySelector('.comments__body').insertBefore(newMessageDiv, parentLoaderDiv);
}

//отображение комментариев с сервера
function updateCommentForm(newComment) {
    if (!newComment) return;
    Object.keys(newComment).forEach(id => {
        if (id in showComments) return;

        showComments[id] = newComment[id];
        let needCreateNewForm = true;

        Array.from(commentsWrap.querySelectorAll('.comments__form')).forEach(form => {
            // если уже существует форма с заданными координатами left и top, добавляем сообщение в эту форму
            if (+form.dataset.left === showComments[id].left && +form.dataset.top === showComments[id].top) {
                form.querySelector('.loader').parentElement.style.display = 'none';
                // добавляем в эту форму сообщение
                addMessageComment(newComment[id], form);
                needCreateNewForm = false;
            }
        });
        // если формы с заданными координатами пока нет на холсте, создаем эту форму и добавляем в нее сообщение
        if (needCreateNewForm) {
            const newForm = createCommentForm(newComment[id].left + 22, newComment[id].top + 14);
            newForm.dataset.left = newComment[id].left;
            newForm.dataset.top = newComment[id].top;
            newForm.style.left = newComment[id].left + 'px';
            newForm.style.top = newComment[id].top + 'px';
            commentsWrap.appendChild(newForm);
            addMessageComment(newComment[id], newForm);
            if (!wrapApp.querySelector('#comments-on').checked) {
                newForm.style.display = '';
            }
        }
    });
}

// обработка комментария, пришедшего через вэбсокет (преобразуем к тому же формату, что приходит по AJAX)
function insertWssCommentForm(wssComment) {
    const wsCommentEdited = {};
    wsCommentEdited[wssComment.id] = {};
    wsCommentEdited[wssComment.id].left = wssComment.left;
    wsCommentEdited[wssComment.id].message = wssComment.message;
    wsCommentEdited[wssComment.id].timestamp = wssComment.timestamp;
    wsCommentEdited[wssComment.id].top = wssComment.top;
    updateCommentForm(wsCommentEdited);
}

function wss() {
    connection = new WebSocket(`${urlWss}/${dataGetParse.id}`);

    connection.addEventListener('message', event => {
        if (JSON.parse(event.data).event === 'pic') {
            if (JSON.parse(event.data).pic.mask) {
                canvas.style.background = `url(${JSON.parse(event.data).pic.mask})`;
            } else {
                canvas.style.background = ``;
            }
        }

        if (JSON.parse(event.data).event === 'comment') {
            insertWssCommentForm(JSON.parse(event.data).comment);
        }

        if (JSON.parse(event.data).event === 'mask') {
            canvas.style.background = `url(${JSON.parse(event.data).url})`;
        }
    });
}

// проверяем ссылку на параметр id
function urlId(id) {
    if (!id) { return; }
    setReview(id);
    showMenuComments();
}

//---------------Рисование-------------------
// --- кривые и фигуры ---

// рисуем точку
function circle(point) {
    ctx.beginPath();
    ctx.arc(...point, BRUSH_RADIUS / 2, 0, 2 * Math.PI);
    ctx.fill();
}

// рисуем плавную линию между двумя точками
function smoothCurveBetween(p1, p2) {
    const cp = p1.map((coord, idx) => (coord + p2[idx]) / 2);
    ctx.quadraticCurveTo(...p1, ...cp);
}

// рисуем плавную линию между множеством точек
function smoothCurve(points) {
    ctx.beginPath();
    ctx.lineWidth = BRUSH_RADIUS;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.moveTo(...points[0]);

    for (let i = 1; i < points.length - 1; i++) {
        smoothCurveBetween(points[i], points[i + 1]);
    }

    ctx.stroke();
}

// задаем координаты точки в виде массива
function makePoint(x, y) {
    return [x, y];
}

function repaint() {
    // очищаем перед перерисовкой
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    curves.forEach((curve) => {
        ctx.strokeStyle = curve.color;
        ctx.fillStyle = curve.color;

        circle(curve[0]);
        smoothCurve(curve);

    });
}

// отправка канвас на сервер
function sendMaskState() {
    canvas.toBlob(function(blob) {
        connection.send(blob);
        console.log(connection);
    });
}

// проверяем и при необходимости перерисовываем холст в каждый AnimationFrame
function tick() {
    if (letInitial('menu').offsetHeight > 66) {
        letInitial('menu').style.left = (wrapApp.offsetWidth - letInitial('menu').offsetWidth) - 10 + 'px';
    }
    if (needsRepaint) {
        repaint();
        needsRepaint = false;
    }

    window.requestAnimationFrame(tick);
}