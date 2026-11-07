/* Dag Tours — поведение страницы v2: дорога-фильм (серпантин, машина с «физикой»),
   меню, модалка брони, даты, отзывы, формы. Без зависимостей. */
(function () {
  'use strict';
  var doc = document.documentElement;
  doc.classList.remove('no-js');
  doc.classList.add('js');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia('(pointer: coarse)').matches;
  var WA = 'https://wa.me/79041606202?text=' + encodeURIComponent('Здравствуйте! Меня заинтересовал ваш тур по Дагестану с Маратом. Есть вопрос к вам: ');
  document.querySelectorAll('a[data-wa]').forEach(function (a) { a.href = WA; });

  /* ---------- Якоря: раскрыть details по ссылке, переключить даты, закрыть бургер ---------- */
  function openTarget(hash) {
    if (!hash || hash.length < 2) return;
    var el = document.getElementById(hash.slice(1));
    if (el && el.tagName === 'DETAILS') el.open = true;
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    openTarget(a.getAttribute('href'));
    if (a.dataset.dur) { var r = document.getElementById('d' + a.dataset.dur); if (r) r.checked = true; }
    var menu = document.querySelector('.nav__menu');
    if (menu && menu.open) menu.open = false;
  });
  window.addEventListener('hashchange', function () { openTarget(location.hash); });
  openTarget(location.hash);

  if (window.innerWidth >= 900) document.querySelectorAll('details[data-open-desktop]').forEach(function (d) { d.open = true; });

  /* ---------- Меню: класс для бургера (запас для старых браузеров без :has) и светлая тема ---------- */
  var nav = document.querySelector('.nav');
  var navBar = document.querySelector('.nav__bar');
  var burger = document.querySelector('.nav__menu');
  if (burger) burger.addEventListener('toggle', function () { navBar.classList.toggle('nav--open', burger.open); });
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) nav.classList.toggle('nav--light', en.target.dataset.theme === 'light');
      });
    }, { rootMargin: '-70px 0px -80% 0px' });
    document.querySelectorAll('main > section[data-theme]').forEach(function (s) { io.observe(s); });
  }

  /* ---------- Даты: прошедшие скрыть, ближайшие подсветить, билет пересчитать ---------- */
  var today = new Date(); today.setHours(0, 0, 0, 0);
  function parseVal(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})\|(\w+)/.exec(v || '');
    return m ? { d: new Date(+m[1], +m[2] - 1, +m[3]), days: m[4] } : null;
  }
  document.querySelectorAll('.trip[data-date]').forEach(function (t) {
    var v = parseVal(t.dataset.date);
    if (v && v.d < today) t.hidden = true;
  });
  ['5', '3'].forEach(function (days) {
    document.querySelectorAll('.trip.trip--' + days + ':not([hidden])').forEach(function (t, i) { if (i < 3) t.classList.add('trip--soon'); });
  });
  document.querySelectorAll('select[name="tour_date"]').forEach(function (sel) {
    sel.querySelectorAll('option[value]').forEach(function (o) { var v = parseVal(o.value); if (v && v.d < today) o.remove(); });
    sel.querySelectorAll('optgroup').forEach(function (g) { if (!g.children.length) g.remove(); });
  });
  var firstTrip = document.querySelector('.trip.trip--5:not([hidden])');
  if (firstTrip) {
    var td = document.querySelector('.ticket__date');
    if (td) td.textContent = firstTrip.querySelector('.trip__d').textContent + ' ' + firstTrip.querySelector('.trip__m').textContent;
    document.querySelectorAll('[data-book][data-tour="5"]').forEach(function (b) { b.dataset.date = firstTrip.dataset.date; });
  }

  /* ---------- Формы: тур ↔ даты, отправка, запасной выход в WhatsApp/Telegram ---------- */
  function syncTour(form) {
    var tour = form.querySelector('select[name="tour"]');
    if (!tour) return;
    var one = tour.value === 'oneday' || tour.value === 'custom';
    var wi = form.querySelector('input[name="wish"]');
    if (wi) wi.placeholder = tour.value === 'custom' ? 'Сколько вас, на сколько дней, когда' : 'Дербент, 12 июня';
    var fd = form.querySelector('.f-date'), fw = form.querySelector('.f-wish');
    if (fd) fd.hidden = one;
    if (fw) fw.hidden = !one;
    var sel = form.querySelector('select[name="tour_date"]');
    if (sel) {
      sel.querySelectorAll('option[value]').forEach(function (o) {
        var v = parseVal(o.value);
        o.hidden = !!v && v.days !== tour.value;
      });
      sel.querySelectorAll('optgroup').forEach(function (g) {
        g.hidden = !Array.prototype.some.call(g.children, function (o) { return !o.hidden; });
      });
      var cur = sel.options[sel.selectedIndex];
      if (cur && cur.hidden) sel.value = '';
    }
  }
  document.querySelectorAll('form.form').forEach(function (form) {
    var tour = form.querySelector('select[name="tour"]');
    if (tour) { tour.addEventListener('change', function () { syncTour(form); }); syncTour(form); }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var btn = form.querySelector('button[type="submit"]');
      var label = btn.textContent;
      btn.disabled = true; btn.textContent = 'Отправляем…';
      form.classList.remove('is-err');
      var data = new FormData(form);
      data.append('source_page', location.href);
      var sel = form.querySelector('select[name="tour_date"]');
      var dateText = sel && sel.selectedIndex > 0 ? sel.options[sel.selectedIndex].text : (data.get('wish') || '');
      var ctl = 'AbortController' in window ? new AbortController() : null;
      var tmo = setTimeout(function () { if (ctl) ctl.abort(); }, 15000);
      fetch(form.action, { method: 'POST', body: data, headers: { 'Accept': 'application/json' }, signal: ctl ? ctl.signal : undefined })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function () { form.classList.add('is-ok'); })
        .catch(function () {
          form.classList.add('is-err');
          var wa = form.querySelector('.form__err a.btn--wa');
          if (wa) {
            var txt = 'Здравствуйте! Хочу забронировать тур. Имя: ' + (data.get('name') || '') +
              ', контакт: ' + (data.get('phone') || '') + (dateText ? ', дата: ' + dateText : '') +
              (data.get('direction') ? ', направление: ' + data.get('direction') : '');
            wa.href = 'https://wa.me/79041606202?text=' + encodeURIComponent(txt);
          }
        })
        .then(function () { clearTimeout(tmo); btn.disabled = false; btn.textContent = label; });
    });
  });

  /* ---------- Модалка брони ---------- */
  var modal = document.getElementById('book-modal');
  if (modal && typeof modal.showModal === 'function') {
    var mform = modal.querySelector('form');
    document.querySelectorAll('[data-book]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var tour = mform.querySelector('select[name="tour"]');
        var sel = mform.querySelector('select[name="tour_date"]');
        var wish = mform.querySelector('input[name="wish"]');
        if (btn.dataset.tour && tour) tour.value = btn.dataset.tour;
        syncTour(mform);
        if (btn.dataset.date && sel) sel.value = btn.dataset.date;
        if (btn.dataset.dir && wish) wish.value = btn.dataset.dir + ', ';
        modal.showModal();
        if (!coarse) { var first = mform.querySelector('input[name="name"]'); if (first) first.focus(); }
      });
    });
    modal.querySelector('.modal__close').addEventListener('click', function () { modal.close(); });
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.close(); });
  }

  /* ---------- Отзывы: увеличить по клику ---------- */
  var lb = document.getElementById('lightbox');
  if (lb && typeof lb.showModal === 'function') {
    var lbImg = lb.querySelector('img');
    document.querySelectorAll('[data-zoom]').forEach(function (b) {
      b.addEventListener('click', function () {
        var img = b.querySelector('img');
        lbImg.src = b.dataset.zoom; lbImg.alt = img ? img.alt : '';
        lb.showModal();
      });
    });
    lb.querySelector('button').addEventListener('click', function () { lb.close(); });
    lb.addEventListener('click', function (e) { if (e.target === lb) lb.close(); });
  }

  /* ================= ДОРОГА-ФИЛЬМ ================= */
  var film = document.querySelector('.film');
  if (!film) return;
  var track = film.querySelector('.film__track');
  var scenes = Array.prototype.slice.call(film.querySelectorAll('.scene'));
  var caps = Array.prototype.slice.call(film.querySelectorAll('.caption__card'));
  var tlStops = Array.prototype.slice.call(film.querySelectorAll('.timeline__stop'));
  var tlFill = film.querySelector('.timeline__fill');
  var slateDay = film.querySelector('.slate__day');
  var slatePlace = film.querySelector('.slate__place');
  var slateNote = film.querySelector('.slate__note');
  var slateTime = film.querySelector('.slate__time');
  var dayItems = Array.prototype.slice.call(film.querySelectorAll('.daybar__item'));
  var dayNow = film.querySelector('.daybar__now');
  var dayList = film.querySelector('.daybar__list'), lastDayOn = null;
  var N = scenes.length;
  track.style.setProperty('--stops', N + 1.2);

  // Таймлайн равномерный: доли F; дорога — свои доли S (остановки на прямых серпантина)
  var F = [];
  for (var i = 0; i < N; i++) F.push(0.03 + (0.8 * i) / (N - 1));
  var FIN = F[N - 1] + 0.03;
  tlStops.forEach(function (s, i) { s.style.left = (F[i] * 100) + '%'; });

  var svg, path, done, car, body, shadow, stops, notes, finish, S, len, W, H, mobile, plane;
  var K = coarse ? 0.18 : 0.12;
  var p = 0, pv = 0, raf = 0, active = -1, onStop = false, prevAng = 0, lean = 0, sPrev = 0, vPrev = 0;
  var passed = false, collapsed = false, lastY = window.scrollY, lastNavY = lastY;   // ушли вниз и вернулись — фильм не крутим назад

  function pickSvg() {
    var all = film.querySelectorAll('svg.road__wide, svg.road__tall');
    for (var k = 0; k < all.length; k++) if (all[k].getClientRects().length) return all[k];
    return all[0];
  }
  function pointAt(s) { return path.getPointAtLength(Math.min(len, Math.max(0, s))); }
  function toS(q) {
    // кусочное сопоставление F -> S с торможением у остановок и разгоном между ними
    if (q <= F[0]) return len * S[0] * (q / F[0]);
    if (q >= F[N - 1]) return len * (S[N - 1] + (1 - S[N - 1]) * ((q - F[N - 1]) / (1 - F[N - 1])));
    var i = 0;
    while (i < N - 2 && q >= F[i + 1]) i++;
    var t = (q - F[i]) / (F[i + 1] - F[i]);
    return len * (S[i] + (S[i + 1] - S[i]) * smoothQ(t));
  }
  function normal(s) {
    var a = pointAt(s - 8), b = pointAt(s + 8);
    var dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
    return { x: -dy / l, y: dx / l };
  }
  function setup() {
    svg = pickSvg();
    mobile = svg.classList.contains('road__tall');
    path = svg.querySelector('.r-asphalt');
    done = svg.querySelector('.r-done');
    car = svg.querySelector('.car');
    body = svg.querySelector('.car__body');
    shadow = svg.querySelector('.car__shadow');
    stops = Array.prototype.slice.call(svg.querySelectorAll('.stop'));
    notes = Array.prototype.slice.call(svg.querySelectorAll('.note'));
    finish = svg.querySelector('.finish');
    S = svg.dataset.stops.split(',').map(Number);
    W = +svg.dataset.w; H = +svg.dataset.h;
    len = path.getTotalLength();
    done.style.strokeDasharray = len + ' ' + len;
    done.style.strokeDashoffset = len;
    stops.forEach(function (g, i) {
      var pt = pointAt(len * S[i]);
      g.setAttribute('transform', 'translate(' + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1) + ')');
      var lbl = g.querySelector('.stop__label');
      if (lbl && scenes[i]) lbl.textContent = scenes[i].dataset.place;
    });
    plane = svg.querySelector('.plane');
    if (finish) {
      var fi = parseInt(finish.dataset.after, 10);
      var fp = pointAt(len * S[fi]);
      finish.setAttribute('transform', 'translate(' + fp.x.toFixed(1) + ' ' + fp.y.toFixed(1) + ')');
    }
    notes.forEach(function (n) {
      var a = +n.dataset.from, b = +n.dataset.to;
      var mid = len * (S[a] + S[b]) / 2;
      var pt = pointAt(mid), nr = normal(mid);
      var off = (b % 2 ? -1 : 1) * 46;
      var x = pt.x + nr.x * off, y = pt.y + nr.y * off;
      x = Math.max(120, Math.min(W - 120, x)); y = Math.max(60, Math.min(H - 60, y));
      var text = n.querySelector('text'), rect = n.querySelector('rect');
      text.setAttribute('x', x); text.setAttribute('y', y); text.setAttribute('text-anchor', 'middle');
      var bb = text.getBBox();
      rect.setAttribute('x', bb.x - 12); rect.setAttribute('y', bb.y - 5);
      rect.setAttribute('width', bb.width + 24); rect.setAttribute('height', bb.height + 10);
      n.setAttribute('transform', 'rotate(-3 ' + x + ' ' + y + ')');
    });
    pv = p = progress(); active = -1;
    draw(pv, true);
  }

  var lastTxt = {};
  function setText(el, key, v, html) { if (!el || lastTxt[key] === v) return; lastTxt[key] = v; if (html) el.innerHTML = v; else el.textContent = v; }
  function hydrate(i) {
    var sc = scenes[i]; if (!sc || sc.dataset.h) return; sc.dataset.h = '1';
    sc.querySelectorAll('[data-srcset]').forEach(function (el) { el.srcset = el.dataset.srcset; });
    var im = sc.querySelector('img[data-src]'); if (im) im.src = im.dataset.src;
  }
  function progress() {
    var rect = track.getBoundingClientRect();
    var total = rect.height - window.innerHeight;
    if (total < 2) return collapsed ? 1 : 0;
    return Math.min(1, Math.max(0, -rect.top / total));
  }
  // свёрнутый фильм: дорожка в один экран, показываем финальный кадр; страницу под нами не дёргаем
  function setCollapsed(on) {
    if (on === collapsed) return;
    var before = track.getBoundingClientRect().height;
    collapsed = on; film.classList.toggle('film--collapsed', on);
    var after = track.getBoundingClientRect().height;
    if (track.getBoundingClientRect().top < 0) {
      // мгновенно, чтобы прервать плавную прокрутку браузера и не уехать мимо
      var de = document.documentElement, sb = de.style.scrollBehavior; de.style.scrollBehavior = 'auto';
      window.scrollTo({ top: window.scrollY + (after - before), left: 0, behavior: 'instant' });
      de.style.scrollBehavior = sb;
    }
  }
  function nearest(q) {
    var best = 0, d = 1;
    for (var i = 0; i < N; i++) { var dd = Math.abs(q - F[i]); if (dd < d) { d = dd; best = i; } }
    return best;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smoothQ(t) { return t * t * (3 - 2 * t); }

  function draw(q, force) {
    var s = toS(q);
    var is3d = !!gl;
    var pt = pointAt(s), ahead = pointAt(s + 10), back = pointAt(s - 10);
    var ang = Math.atan2(ahead.y - back.y, ahead.x - back.x) * 180 / Math.PI;
    var dA = ang - prevAng; if (dA > 180) dA -= 360; if (dA < -180) dA += 360;
    if (force) dA = 0;
    lean += (clamp(dA * 2.5, -8, 8) - lean) * 0.2;
    prevAng = ang;
    var v = s - sPrev, dv = v - vPrev;
    sPrev = s; vPrev = v;
    // масштаб по «удалённости»: внизу ближе, вверху дальше
    var sc = (mobile ? 0.36 : 0.56) * (1.15 - 0.3 * (1 - pt.y / H));
    if (!is3d) car.setAttribute('transform', 'translate(' + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1) + ')');
    // финал в 2D: машина уезжает, самолёт уходит вверх-вправо
    var fq = clamp((q - FIN) / (1 - FIN), 0, 1);
    car.classList.toggle('is-gone', fq > 0.15);
    if (plane && !is3d) {
      plane.classList.toggle('is-on', fq > 0.1);
      var endP = pointAt(len);
      var e = smoothQ(clamp((fq - 0.1) / 0.9, 0, 1));
      plane.setAttribute('transform', 'translate(' + (endP.x + e * (mobile ? 120 : 420)).toFixed(1) + ' ' + (endP.y - e * (mobile ? 260 : 380)).toFixed(1) + ') rotate(-28) scale(' + (0.5 + e * 1.6).toFixed(2) + ')');
    }
    car.classList.toggle('is-brake', dv < -0.6 && v > 0.3);
    if (!is3d) {
      body.setAttribute('transform', 'rotate(' + (ang + lean * 0.5).toFixed(1) + ') scale(' + sc.toFixed(3) + ')');
      shadow.setAttribute('transform', 'translate(' + (3 - lean * 0.6).toFixed(1) + ' 5) scale(' + (sc / 0.56).toFixed(2) + ')');
      done.style.strokeDashoffset = Math.max(0, len - s);
    }

    // Сцена с гистерезисом окна «на месте»
    var idx = nearest(q);
    var finale = q > FIN + 0.04;
    var win = idx === active && onStop ? 0.065 : 0.045;
    var near = !finale && Math.abs(q - F[idx]) < win;
    if (idx !== active) {
      if (active >= 0) scenes[active].classList.remove('is-on');
      scenes[idx].classList.add('is-on');
      active = idx;
      var sc0 = scenes[idx];
      slateDay.textContent = sc0.dataset.slate;
      slateTime.textContent = sc0.dataset.time || '';
      car.classList.toggle('is-dark', !!sc0.dataset.dark);
      if (!reduceMotion) { slateDay.classList.remove('is-clap'); void slateDay.offsetWidth; slateDay.classList.add('is-clap'); }
      if (!gl) { hydrate(idx); hydrate(idx + 1); }   // кадры 2D грузим по одному, в 3D не грузим вовсе
    }
    onStop = near;
    setText(slatePlace, 'place', finale ? 'аэропорт Махачкалы' : (near ? scenes[idx].dataset.place : 'в дороге'));
    if (finale) { slateDay.textContent = 'Финал'; slateTime.textContent = 'взлёт'; }
    else if (slateDay.textContent === 'Финал') { slateDay.textContent = scenes[idx].dataset.slate; slateTime.textContent = scenes[idx].dataset.time || ''; }
    // наезд камеры «оседает» + параллакс за машиной
    if (!reduceMotion) {
      var w0 = idx === 0 ? 0 : (F[idx - 1] + F[idx]) / 2;
      var w1 = idx === N - 1 ? 1 : (F[idx] + F[idx + 1]) / 2;
      var t = clamp((q - w0) / (w1 - w0), 0, 1);
      var img = scenes[idx].querySelector('img');
      img.style.setProperty('--kb', (1.16 - 0.1 * t).toFixed(3));
      img.style.setProperty('--px', (-(pt.x / W - 0.5) * (mobile ? 10 : 24)).toFixed(1) + 'px');
      img.style.setProperty('--py', (-(pt.y / H - 0.5) * (mobile ? 6 : 16)).toFixed(1) + 'px');
    }
    caps.forEach(function (c, i) { c.classList.toggle('is-on', i === N ? (finale && q > FIN + 0.09) : (i === idx && near)); });
    var noteText = '';
    notes.forEach(function (n) {
      var a = +n.dataset.from, b = +n.dataset.to;
      var on = q > F[a] + 0.045 && q < F[b] - 0.045;
      n.classList.toggle('is-on', on);
      if (on) noteText = n.querySelector('text').textContent;
    });
    if (mobile && !noteText) {
      // на телефоне пометки живут в верхней плашке
      var wn = film.querySelector('.road__wide .note[data-from="' + idx + '"]');
      if (!near && wn) noteText = wn.querySelector('text').textContent;
    }
    slateNote.textContent = noteText;
    stops.forEach(function (g, i) {
      g.classList.toggle('is-done', q > F[i] + 0.045);
      g.classList.toggle('is-on', i === idx && near);
    });
    if (finish) finish.classList.toggle('is-on', q >= F[parseInt(finish.dataset.after, 10)] - 0.045);
    tlStops.forEach(function (b, i) {
      b.classList.toggle('is-done', q > F[i] + 0.045);
      b.classList.toggle('is-on', i === idx && near);
    });
    // панель дней: активный день, пройденные, следующий; строка «куда едем»
    var heading = (!near && !finale && q > F[idx] + 0.045) ? idx + 1 : idx;
    dayItems.forEach(function (it, i) {
      var isFin = i === N;
      it.classList.toggle('is-on', finale ? isFin : (near ? i === idx : i === heading));
      it.classList.toggle('is-done', finale ? i < N : i < (near ? idx : heading));
      it.classList.toggle('is-next', !near && !finale && i === heading + 1);
    });
    // на телефоне лента дней листается вбок — держим активный день в центре
    if (dayList && dayList.scrollWidth > dayList.clientWidth + 4) {
      var onIt = dayList.querySelector('.is-on');
      if (onIt && onIt !== lastDayOn) { lastDayOn = onIt; dayList.scrollTo({ left: onIt.offsetLeft - (dayList.clientWidth - onIt.offsetWidth) / 2, behavior: reduceMotion ? 'auto' : 'smooth' }); }
    }
    if (dayNow) {
      setText(dayNow, 'now', finale ? '<b>Финал.</b> Путешествие подойдёт к концу — до встречи!'
        : near ? '<b>Мы на месте.</b> ' + (scenes[idx].dataset.place || '')
        : heading < N ? '<b>Едем в день ' + heading + ':</b> ' + (scenes[heading].dataset.place || '')
        : '<b>Едем в аэропорт.</b>', true);
    }
    tlFill.style.transform = 'scaleX(' + q.toFixed(4) + ')';
    var rect = track.getBoundingClientRect();
    var inFilm = rect.top < 90 && rect.bottom > 90;   // шапка и нижняя панель уходят до появления плашек фильма и возвращаются после шкалы
    document.body.classList.toggle('in-film', inFilm);
    if (gl) { gl.update(q, idx, near, car.classList.contains('is-brake'), !!scenes[idx].dataset.dark); gl.setVisible(rect.bottom > 0 && rect.top < window.innerHeight); }
  }

  var lastTs = 0;
  function loop(ts) {
    var dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016; lastTs = ts;
    var d = p - pv;
    if (Math.abs(d) < 4e-4) { pv = p; draw(pv); raf = 0; lastTs = 0; return; }
    pv += d * (1 - Math.exp(-dt * (coarse ? 6 : 4)));
    draw(pv);
    raf = requestAnimationFrame(loop);
  }
  function snapFilm() {
    // без проигрывания дороги: 2D и 3D сразу в нужном кадре
    if (raf) { cancelAnimationFrame(raf); raf = 0; lastTs = 0; }
    pv = p = progress(); draw(pv, true);
    if (gl) gl.snap();
  }
  function onScroll() {
    var y = window.scrollY, goingUp = y < lastY; lastY = y;
    var fr = film.getBoundingClientRect(), vh = window.innerHeight;
    if (fr.bottom < 0) passed = true;                                // блок целиком ушёл вверх — назад его не крутим
    if (fr.top > vh) { passed = false; if (collapsed) { setCollapsed(false); snapFilm(); } }   // блок целиком ниже экрана — разворачиваем невидимо, машина на старте
    else if (passed && goingUp && !collapsed) { setCollapsed(true); snapFilm(); }               // возвращаемся снизу — один экран с финальным кадром
    p = progress();
    document.body.classList.toggle('past-hero', window.scrollY > window.innerHeight * 0.7);
    // телефон: шапка прячется при прокрутке вниз и возвращается при прокрутке вверх
    if (Math.abs(y - lastNavY) > 8) { document.body.classList.toggle('nav-hidden', !goingUp && y > vh && !document.querySelector('.nav__menu[open]')); lastNavY = y; }
    if (can3d && !glLoading && track.getBoundingClientRect().top < window.innerHeight * 1.6) load3d();
    if (reduceMotion) { pv = p; draw(pv, true); return; }
    if (!raf) raf = requestAnimationFrame(loop);
  }
  tlStops.forEach(function (b, i) {
    b.addEventListener('click', function () {
      var rect = track.getBoundingClientRect();
      var y = window.scrollY + rect.top + F[i] * (rect.height - window.innerHeight);
      window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  });
  /* 3D-дорога (three.js) — десктоп с WebGL, грузится лениво при подходе к секции */
  var gl = null, glLoading = false;
  var glParam = /[?&]gl=(\d)/.exec(location.search);
  var conn = navigator.connection || {};
  var slowNet = !!conn.saveData || /(^|-)2g|3g/.test(conn.effectiveType || '');
  // iPhone/iPad: Safari не сообщает память и занижает число ядер, а графика у них сильная — пускаем в 3D,
  // слабые модели отсеет замер кадров (onPerf). Android: от 4 ГБ памяти и 6 ядер.
  var isApple = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var strongPhone = isApple || ((navigator.deviceMemory || 4) >= 4 && (navigator.hardwareConcurrency || 4) >= 6);
  var lite = coarse || window.innerWidth < 900;
  var remembered = null; try { if (glParam && glParam[1] === '1') localStorage.removeItem('dt-gl'); remembered = localStorage.getItem('dt-gl'); } catch (e) {}
  function hasWebGL() {
    try { var c = document.createElement('canvas'); var g = c.getContext('webgl2') || c.getContext('webgl'); if (!g) return false; var x = g.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); return true; } catch (e) { return false; }
  }
  var want3d = !!film.dataset.gl && !reduceMotion && (glParam ? glParam[1] === '1' : (!slowNet && remembered !== '0' && (!lite || strongPhone)));
  var can3d = want3d && hasWebGL();
  if (can3d) film.classList.add('film--gl-wait');   // пока 3D грузится, 2D-маршрут не мелькает
  function to2d(remember) {
    // 3D не тянет / потерян контекст / не загрузилось — тихо переходим на 2D
    can3d = false; film.classList.remove('film--3d', 'film--gl-wait');
    if (gl && gl.dispose) { try { gl.dispose(); } catch (e) {} }
    gl = null;
    if (remember) { try { localStorage.setItem('dt-gl', '0'); } catch (e) {} }
    hydrate(active < 0 ? 0 : active); hydrate((active < 0 ? 0 : active) + 1); snapFilm();
  }
  function load3d() {
    if (!can3d || glLoading) return;
    glLoading = true;
    var timer = setTimeout(function () { if (!gl) to2d(false); }, 9000);   // не успели — остаёмся в 2D
    import(new URL(film.dataset.gl, location.href).href).then(function (m) {
      if (!can3d) return;
      clearTimeout(timer);
      var photos = scenes.map(function (s) { return s.dataset.photo || ''; });
      var labels = scenes.map(function (s) { return s.dataset.place || ''; });
      gl = m.create(film.querySelector('.film__stage'), { photos: photos, labels: labels, stops: N, lite: lite,
        onPerf: function (ms) { if (ms > (lite ? 34 : 40)) to2d(true); else if (!lite && ms > 22 && gl && gl.setQuality) gl.setQuality('low'); },
        onLost: function () { to2d(false); } });
      film.classList.add('film--3d'); film.classList.remove('film--gl-wait');
      gl.resize();
      gl.update(pv, active, onStop, false, !!(scenes[active] && scenes[active].dataset.dark));
    }).catch(function (err) { clearTimeout(timer); to2d(false); if (window.console) console.warn('3D выключено:', err); });
  }
  if (!can3d) { hydrate(0); hydrate(1); }
  setup();
  window.addEventListener('scroll', onScroll, { passive: true });
  // после перезагрузки браузер восстанавливает прокрутку без события scroll — проверяем сами
  window.addEventListener('load', onScroll); window.addEventListener('pageshow', onScroll); setTimeout(onScroll, 400); onScroll();
  var rt;
  var lastW = window.innerWidth;   // на телефоне resize прилетает при каждом показе адресной строки — пересобираем только при смене ширины
  window.addEventListener('resize', function () { if (window.innerWidth === lastW) return; lastW = window.innerWidth; clearTimeout(rt); rt = setTimeout(setup, 150); });

/* липкая нижняя панель: не висит над формой брони и над клавиатурой */
(function () {
  var book = document.getElementById('book');
  if (book && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (e) { document.body.classList.toggle('at-book', e[0].isIntersecting); }, { rootMargin: '0px 0px -30% 0px' }).observe(book);
  }
  document.addEventListener('focusin', function (e) { if (e.target.matches('input, select, textarea')) document.body.classList.add('typing'); });
  document.addEventListener('focusout', function () { document.body.classList.remove('typing'); });
  // тап мимо открытого меню закрывает его
  var burger = document.querySelector('.nav__menu');
  if (burger) document.addEventListener('click', function (e) { if (burger.open && !e.target.closest('.nav__bar')) burger.open = false; });
})();
})();
