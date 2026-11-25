const filters = [...document.querySelectorAll('.filters button')];
const cards = document.querySelectorAll('.project');

filters.forEach(button => button.addEventListener('click', () => {
  filters.forEach(filterButton => {
    const active = filterButton === button;
    filterButton.classList.toggle('active', active);
    filterButton.setAttribute('aria-pressed', String(active));
  });
  const filter = button.dataset.filter;
  cards.forEach(card => {
    card.hidden = filter !== 'all' && card.dataset.category !== filter;
  });
}));

const menu = document.querySelector('.menu');
const nav = document.querySelector('.topbar nav');
if (nav && !nav.id) nav.id = 'primary-nav';
if (nav) menu?.setAttribute('aria-controls', nav.id);
menu?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
});
nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  nav.classList.remove('open');
  menu?.setAttribute('aria-expanded', 'false');
  menu?.setAttribute('aria-label', 'Open menu');
}));
const year = document.querySelector('#year');
if (year) year.textContent = new Date().getFullYear();


// GitHub repository catalogue and README-powered project wiki.
(() => {
  const owner = 'JaviLendi';
  const repoGrid = document.getElementById('repo-grid');
  const repoStatus = document.getElementById('repo-status');
  const searchInput = document.getElementById('repo-search');
  const filterButtons = [...document.querySelectorAll('[data-repo-filter]')];
  const modal = document.getElementById('wiki-modal');
  const wikiTitle = document.getElementById('wiki-title');
  const wikiKicker = document.getElementById('wiki-kicker');
  const wikiMeta = document.getElementById('wiki-meta');
  const wikiContent = document.getElementById('wiki-content');
  const wikiSource = document.getElementById('wiki-source');
  let repositories = [];
  let currentFilter = 'all';
  let currentQuery = '';
  let lastFocused = null;

  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const classify = repo => {
    const name = repo.name.toLowerCase();
    const text = `${repo.name} ${repo.description || ''} ${(repo.topics || []).join(' ')}`.toLowerCase();
    if (/vlmpy|aero|aircraft|flight|uaxsat|satellite|cube.?sat|arduino|ibus|rocket|drone|space/.test(text)) return 'aerospace';
    if (/prettysumatrapdf|powershell-profile|winget-pkgs|javilendi\.github\.io/.test(name) || /software|tool|app|pdf|web|internxt|script|reader|backup|automation/.test(text)) return 'software';
    return 'other';
  };
  const languageColor = language => ({Python:'#8ccdd2',JavaScript:'#f0c674',TypeScript:'#7ba9e8',C:'#a6c48a','C++':'#a6c48a',Julia:'#b69ae5',HTML:'#e5a17b',CSS:'#8ccdd2',Arduino:'#8ccdd2'})[language] || '#aebbc3';
  const repoTags = repo => (repo.topics || []).slice(0,4).map(t => `<span>${escapeHTML(t.replaceAll('-', ' '))}</span>`).join('');
  const filteredRepos = () => repositories.filter(repo => {
    const category = classify(repo);
    const query = currentQuery.toLowerCase();
    const matchesFilter = currentFilter === 'all' || category === currentFilter;
    const haystack = `${repo.name} ${repo.description || ''} ${repo.language || ''} ${(repo.topics || []).join(' ')}`.toLowerCase();
    return matchesFilter && (!query || haystack.includes(query));
  });
  const renderRepos = () => {
    const items = filteredRepos();
    repoGrid.innerHTML = items.length ? items.map((repo, index) => `
      <button class="repo-card" type="button" data-repo="${escapeHTML(repo.name)}" aria-label="Open project wiki for ${escapeHTML(repo.name)}">
        <div class="repo-card-top"><span class="repo-language" style="color:${languageColor(repo.language)}">${escapeHTML(repo.language || 'Repository')}</span>${repo.fork ? '<span class="repo-fork">FORK</span>' : (repo.archived ? '<span class="repo-fork">ARCHIVED</span>' : '')}</div>
        <h3>${escapeHTML(repo.name.replaceAll('-', ' '))}</h3>
        <p>${escapeHTML(repo.description || 'Public repository by the portfolio owner. Open the project wiki to explore its README and repository details.')}</p>
        <div class="repo-tags">${repoTags(repo)}</div>
        <div class="repo-card-foot"><span>★ ${Number(repo.stargazers_count || 0)}　⑂ ${Number(repo.forks_count || 0)}</span><b>OPEN WIKI ↗</b></div>
      </button>`).join('') : '<div class="repo-empty">No repositories match this search. Try a different keyword or filter.</div>';
    repoStatus.textContent = `${items.length} of ${repositories.length} public repositories · Updated from GitHub`;
  };

  const markdownURL = (url, repo, image=false) => {
    const value = String(url || '').trim().replace(/&amp;/g, '&');
    if (/^(javascript:|data:|vbscript:)/i.test(value)) return '#';
    const githubBlob = value.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/i);
    const encodePath = path => path.split('/').map(segment => {
      try {
        return encodeURIComponent(decodeURIComponent(segment));
      } catch {
        return encodeURIComponent(segment);
      }
    }).join('/');
    if (image && githubBlob) {
      const [, imageOwner, imageRepo, imageBranch, imagePath] = githubBlob;
      return `https://raw.githubusercontent.com/${imageOwner}/${imageRepo}/${encodeURIComponent(imageBranch)}/${encodePath(imagePath)}`;
    }
    if (/^(https?:|mailto:|#)/i.test(value)) return value;
    const clean = value.replace(/^\.\//,'').replace(/^\//,'');
    const branch = encodeURIComponent(repo.default_branch || 'main');
    const root = image ? `https://raw.githubusercontent.com/${owner}/${repo.name}/${branch}/` : `https://github.com/${owner}/${repo.name}/blob/${branch}/`;
    return root + encodePath(clean);
  };
  const inlineMarkdown = (text, repo) => {
    let safe = escapeHTML(text);
    safe = safe.replace(/`([^`]+)`/g, '<code>$1</code>');
    safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
    safe = safe.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => `<img alt="${alt}" src="${escapeHTML(markdownURL(url, repo, true))}" loading="lazy" decoding="async">`);
    safe = safe.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => `<a href="${escapeHTML(markdownURL(url, repo))}" target="_blank" rel="noreferrer">${label}</a>`);
    return safe;
  };
  // A small README renderer for headings, lists, fenced code, tables, quotes and links.
  // HTML is escaped before inline Markdown substitutions to keep README markup inert.
  const markdownToHTML = (markdown, repo) => {
    const lines = markdown.replace(/\r/g, '').split('\n');
    const out = [];
    let paragraph = [], listType = null, code = false, codeLines = [], table = false;
    const flushParagraph = () => { if (paragraph.length) { out.push(`<p>${inlineMarkdown(paragraph.join(' '), repo)}</p>`); paragraph = []; } };
    const flushList = () => { if (listType) { out.push(`</${listType}>`); listType = null; } };
    const flushTable = () => { if (table) { out.push('</tbody></table>'); table = false; } };
    for (let i=0;i<lines.length;i++) {
      const line = lines[i];
      if (/^\s*```/.test(line) || /^\s*~~~/.test(line)) {
        flushParagraph(); flushList(); flushTable();
        if (code) { out.push(`<pre><code>${escapeHTML(codeLines.join('\n'))}</code></pre>`); codeLines=[]; code=false; }
        else code=true;
        continue;
      }
      if (code) { codeLines.push(line); continue; }
      if (!line.trim()) { flushParagraph(); flushList(); flushTable(); continue; }
      const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (heading) { flushParagraph(); flushList(); flushTable(); const level=heading[1].length; out.push(`<h${level}>${inlineMarkdown(heading[2], repo)}</h${level}>`); continue; }
      if (/^\s*(---+|\*\*\*|___)\s*$/.test(line)) { flushParagraph(); flushList(); flushTable(); out.push('<hr>'); continue; }
      if (/^\s*>/.test(line)) { flushParagraph(); flushList(); flushTable(); out.push(`<blockquote>${inlineMarkdown(line.replace(/^\s*>\s?/,''), repo)}</blockquote>`); continue; }
      if (/^\s*\|/.test(line)) {
        flushParagraph(); flushList();
        if (/^\s*\|?\s*:?-{3,}/.test(line)) continue;
        const cells=line.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(c=>c.trim());
        if (!table) { out.push('<table><thead><tr>'+cells.map(c=>`<th>${inlineMarkdown(c, repo)}</th>`).join('')+'</tr></thead><tbody>'); table=true; }
        else out.push('<tr>'+cells.map(c=>`<td>${inlineMarkdown(c, repo)}</td>`).join('')+'</tr>');
        continue;
      }
      const listMatch=line.match(/^\s*(?:[-+*]|(\d+)\.)\s+(.+)$/);
      if (listMatch) { flushParagraph(); flushTable(); const nextType=listMatch[1]?'ol':'ul'; if(listType!==nextType){flushList();out.push(`<${nextType}>`);listType=nextType;} out.push(`<li>${inlineMarkdown(listMatch[2], repo)}</li>`);continue; }
      flushList(); flushTable(); paragraph.push(line.trim());
    }
    flushParagraph(); flushList(); flushTable();
    if (code) out.push(`<pre><code>${escapeHTML(codeLines.join('\n'))}</code></pre>`);
    return out.join('') || '<p>No README documentation was found for this repository.</p>';
  };
  const openWiki = async repo => {
    lastFocused = document.activeElement;
    wikiTitle.textContent = repo.name;
    wikiKicker.textContent = `${owner.toUpperCase()} / PROJECT WIKI`;
    wikiSource.href = repo.html_url;
    wikiMeta.innerHTML = [repo.language || 'Repository', repo.license?.spdx_id || 'Open source / see repository', `${repo.stargazers_count || 0} stars`, `${repo.forks_count || 0} forks`, `Updated ${new Date(repo.updated_at).toLocaleDateString('en-GB')}`].map(x=>`<span>${escapeHTML(x)}</span>`).join('');
    wikiContent.innerHTML = '<p class="wiki-loading">Loading README and project documentation from GitHub…</p>';
    modal.classList.add('open'); modal.setAttribute('aria-hidden','false'); document.body.classList.add('wiki-open');
    modal.querySelector('.wiki-close').focus();
    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${encodeURIComponent(repo.name)}/readme`, {headers:{Accept:'application/vnd.github+json'}});
      if (!response.ok) throw new Error(response.status === 404 ? 'README not found' : `GitHub API returned ${response.status}`);
      const data = await response.json();
      const markdown = atob(data.content.replace(/\s/g,''));
      const decoded = new TextDecoder('utf-8').decode(Uint8Array.from(markdown, c=>c.charCodeAt(0)));
      wikiContent.innerHTML = markdownToHTML(decoded, repo);
    } catch (error) {
      wikiContent.innerHTML = `<p>README could not be loaded from the GitHub API (${escapeHTML(error.message)}). You can still explore the project files and documentation directly.</p><p><a href="${escapeHTML(repo.html_url)}" target="_blank" rel="noreferrer">Open ${escapeHTML(repo.name)} on GitHub ↗</a></p>`;
    }
  };
  const closeWiki = () => { modal.classList.remove('open'); modal.setAttribute('aria-hidden','true'); document.body.classList.remove('wiki-open'); lastFocused?.focus?.(); };
  modal.querySelectorAll('[data-wiki-close]').forEach(el=>el.addEventListener('click',closeWiki));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('open'))closeWiki();});
  repoGrid.addEventListener('click',e=>{const card=e.target.closest('[data-repo]');if(card){const repo=repositories.find(r=>r.name===card.dataset.repo);if(repo)openWiki(repo);}});
  filterButtons.forEach(button=>button.addEventListener('click',()=>{currentFilter=button.dataset.repoFilter;filterButtons.forEach(b=>b.classList.toggle('active',b===button));renderRepos();}));
  searchInput?.addEventListener('input',()=>{currentQuery=searchInput.value.trim();renderRepos();});

  fetch(`https://api.github.com/users/${owner}/repos?type=owner&sort=updated&per_page=100`,{headers:{Accept:'application/vnd.github+json'}})
    .then(response=>{if(!response.ok)throw new Error(`GitHub API returned ${response.status}`);return response.json();})
    .then(data=>{repositories=data.sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at));renderRepos();})
    .catch(error=>{repoStatus.classList.add('error');repoStatus.textContent=`Could not load GitHub repositories (${error.message}). Check your connection or open GitHub directly.`;repoGrid.innerHTML='<div class="repo-empty">The repository list is loaded live from GitHub. Visit <a href="https://github.com/JaviLendi?tab=repositories" target="_blank" rel="noreferrer">github.com/JaviLendi ↗</a> to browse projects.</div>';});
})();


document.addEventListener("DOMContentLoaded",()=>{
  document.addEventListener("click",e=>{
    const card=e.target.closest("article.project");
    if(!card)return;

    const link=card.querySelector(".project-foot a[href]");
    if(!link)return;

    if(e.target.closest("a"))return;

    window.location.href=link.getAttribute("href");
  });
});



document.querySelectorAll('.logo-container, .landing-intro__mark')
    .forEach((logo) => {

        const diamonds = logo.querySelectorAll('.diamond');

        if (diamonds.length !== 3) return;

        const finishedDiamonds = new Set();

        logo.addEventListener('click', () => {
            if (logo.classList.contains('logo-is-spinning')) return;

            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                return;
            }

            finishedDiamonds.clear();
            logo.classList.add('logo-is-spinning');
        });

        logo.addEventListener('animationend', (event) => {
            if (!event.target.matches('.diamond')) return;
            if (!event.animationName.startsWith('logo-spin-')) return;

            finishedDiamonds.add(event.target);

            if (finishedDiamonds.size === diamonds.length) {
                logo.classList.remove('logo-is-spinning');
                finishedDiamonds.clear();
            }
        });
    });
