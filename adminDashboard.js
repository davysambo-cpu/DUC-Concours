/* DUC Concours — console d'administration (rôle vérifié par Supabase) */
const supabase = window.supabaseClient;
let activityChart = null;
let profilsCandidats = [];
let versionChargementProfils = 0;
const animationsKpi = new Map();

function attendreRequeteSupabase(requete, message, delaiMs = 15000) {
  let temporisateur;
  const delai = new Promise((_, reject) => {
    temporisateur = window.setTimeout(() => reject(new Error(message)), delaiMs);
  });
  return Promise.race([Promise.resolve(requete), delai])
    .finally(() => window.clearTimeout(temporisateur));
}

async function initialiserDashboardAdmin() {
  const resultats = await Promise.allSettled([
    remplirTableModeration(),
    initialiserGraphiqueActivite(),
    mettreAJourKPIs(),
    chargerSignalements()
  ]);
  resultats.filter(resultat => resultat.status === 'rejected')
    .forEach(resultat => console.error('Échec de chargement du panneau admin :', resultat.reason));
}

async function remplirTableModeration() {
  const tbody = document.getElementById('admin-moderation-table');
  if (!tbody) return;
  const version = ++versionChargementProfils;

  if (!supabase) {
    profilsCandidats = [];
    afficherLigneVide(tbody, 4, 'Connexion Supabase indisponible.');
    const badge = document.getElementById('admin-badge-moderation');
    if (badge) badge.textContent = 'Indisponible';
    return;
  }

  afficherLigneVide(tbody, 4, 'Chargement des comptes…');
  const badge = document.getElementById('admin-badge-moderation');
  if (badge) badge.textContent = 'Chargement…';
  try {
    const { data, error } = await attendreRequeteSupabase(
      supabase
        .from('profiles')
        .select('id, nom_complet, email, role, est_autorise, date_inscription')
        .order('date_inscription', { ascending: false }),
      'La liste des comptes a dépassé le délai de réponse.'
    );
    if (version !== versionChargementProfils) return;
    if (error) throw error;

    profilsCandidats = Array.isArray(data) ? data : [];
    const enAttente = profilsCandidats.filter(profil => profil.role !== 'admin' && profil.est_autorise !== true).length;
    mettreAJourBadgeModeration(profilsCandidats.length, enAttente);
    dessinerTableModeration();
  } catch (error) {
    if (version !== versionChargementProfils) return;
    console.error('Erreur de chargement des comptes :', error);
    profilsCandidats = [];
    if (badge) {
      badge.textContent = 'Chargement impossible';
      badge.classList.remove('admin-badge-orange');
    }
    afficherLigneVide(tbody, 4, 'Impossible de charger les comptes. Réessayez dans quelques instants.');
    afficherAdminFeedback(`Impossible de charger les comptes : ${error.message || 'erreur inconnue'}`, true);
  }
}

function dessinerTableModeration() {
  const tbody = document.getElementById('admin-moderation-table');
  if (!tbody) return;
  const filtre = (document.getElementById('admin-filtre-moderation')?.value || '').trim().toLocaleLowerCase('fr-FR');
  const comptesFiltres = profilsCandidats.filter(profil =>
    `${profil.nom_complet || ''} ${profil.email || ''} ${profil.role || ''}`.toLocaleLowerCase('fr-FR').includes(filtre)
  );
  tbody.replaceChildren();

  if (comptesFiltres.length === 0) {
    afficherLigneVide(tbody, 4, profilsCandidats.length ? 'Aucun compte ne correspond à cette recherche.' : 'Aucun compte enregistré.');
    return;
  }

  comptesFiltres.forEach(profil => {
    const row = document.createElement('tr');
    const nameCell = document.createElement('td');
    nameCell.className = 'admin-account-identity-cell';
    const name = document.createElement('strong');
    name.className = 'admin-account-name';
    name.textContent = profil.nom_complet || 'Nom non renseigné';
    const email = document.createElement('span');
    email.className = 'admin-account-email';
    email.textContent = profil.email || 'Adresse email non renseignée';
    nameCell.append(name, email);

    const roleCell = document.createElement('td');
    const estAdmin = profil.role === 'admin';
    const role = document.createElement('span');
    role.className = estAdmin ? 'admin-account-role admin-account-role-admin' : 'admin-account-role';
    role.textContent = estAdmin ? 'Administrateur' : 'Candidat';
    roleCell.appendChild(role);

    const dateCell = document.createElement('td');
    dateCell.textContent = formaterDate(profil.date_inscription);

    const accessCell = document.createElement('td');
    const accessGroup = document.createElement('div');
    accessGroup.className = 'admin-account-access';
    const autorise = profil.est_autorise === true;
    const status = document.createElement('span');
    status.className = autorise ? 'admin-account-status admin-account-status-authorized' : 'admin-account-status admin-account-status-pending';
    status.textContent = autorise ? 'Accès autorisé' : 'En attente';
    accessGroup.appendChild(status);

    if (!estAdmin && !autorise) {
      const acceptButton = document.createElement('button');
      acceptButton.type = 'button';
      acceptButton.className = 'btn-accepter';
      acceptButton.textContent = 'Autoriser';
      acceptButton.setAttribute('aria-label', `Autoriser l’accès à ${profil.nom_complet || profil.email || 'ce compte'}`);
      acceptButton.addEventListener('click', () => accepterEtudiant(profil.id, acceptButton));
      accessGroup.appendChild(acceptButton);
    }

    accessCell.appendChild(accessGroup);
    row.append(nameCell, roleCell, dateCell, accessCell);
    tbody.appendChild(row);
  });
}

async function accepterEtudiant(id, bouton) {
  if (!supabase || !id) return;
  if (bouton) bouton.disabled = true;
  try {
    const { data, error } = await attendreRequeteSupabase(
      supabase.from('profiles').update({ est_autorise: true }).eq('id', id).select('id, est_autorise').maybeSingle(),
      'La demande d’autorisation a dépassé le délai de réponse.'
    );
    if (error) throw error;
    if (!data || data.est_autorise !== true) {
      throw new Error('Aucun compte n’a été modifié. Vérifiez vos droits administrateur.');
    }
    afficherAdminFeedback('Accès autorisé. Le statut du compte a été actualisé.', false);
    await Promise.all([remplirTableModeration(), mettreAJourKPIs()]);
  } catch (error) {
    console.error('Erreur lors de l’autorisation du compte :', error);
    afficherAdminFeedback(`L’autorisation n’a pas abouti : ${error.message || 'erreur inconnue'}`, true);
    if (bouton) bouton.disabled = false;
  }
}

function mettreAJourBadgeModeration(total, enAttente) {
  const badge = document.getElementById('admin-badge-moderation');
  if (!badge) return;
  const libelleComptes = `${total} compte${total === 1 ? '' : 's'}`;
  badge.textContent = `${libelleComptes} · ${enAttente === 0 ? 'aucun en attente' : `${enAttente} en attente`}`;
  badge.classList.toggle('admin-badge-orange', enAttente > 0);
}

async function chargerSignalements() {
  const tbody = document.getElementById('admin-signalements-table');
  const badge = document.getElementById('admin-signalements-badge');
  if (!tbody) return;
  if (!supabase) {
    afficherLigneVide(tbody, 4, 'Connexion Supabase indisponible.');
    if (badge) badge.textContent = 'Indisponible';
    return;
  }

  afficherLigneVide(tbody, 4, 'Chargement des retours…');
  try {
    const { data, error } = await attendreRequeteSupabase(
      supabase
        .from('question_reports')
        .select('id, question_id, commentaire, statut, date_signalement')
        .order('date_signalement', { ascending: false })
        .limit(100),
      'Le chargement des signalements a dépassé le délai de réponse.'
    );
    if (error) throw error;

    const rapports = Array.isArray(data) ? data : [];
    const aTraiter = rapports.filter(rapport => rapport.statut === 'nouveau').length;
    if (badge) badge.textContent = rapports.length
      ? `${aTraiter} à traiter · ${rapports.length} au total`
      : 'Aucun retour';

    let questionsParId = new Map();
    try {
      const questions = await db.questions.toArray();
      questionsParId = new Map(questions.map(question => [question.id, question]));
    } catch (errorLecture) {
      console.warn('Le catalogue local ne peut pas enrichir les signalements :', errorLecture);
    }

    tbody.replaceChildren();
    if (rapports.length === 0) {
      afficherLigneVide(tbody, 4, 'Aucun signalement reçu.');
      return;
    }

    rapports.forEach(rapport => {
      const row = document.createElement('tr');
      const questionCell = document.createElement('td');
      const questionLabel = document.createElement('span');
      questionLabel.className = 'report-question';
      const question = questionsParId.get(rapport.question_id);
      questionLabel.textContent = question?.question || 'Question du catalogue';
      questionLabel.title = questionLabel.textContent;
      const questionId = document.createElement('span');
      questionId.className = 'report-id';
      questionId.textContent = rapport.question_id || 'ID inconnu';
      questionCell.append(questionLabel, questionId);

      const commentCell = document.createElement('td');
      const comment = document.createElement('span');
      comment.className = 'report-comment';
      comment.textContent = rapport.commentaire?.trim() || 'Aucun commentaire ajouté.';
      comment.title = comment.textContent;
      commentCell.appendChild(comment);

      const dateCell = document.createElement('td');
      dateCell.textContent = formaterDate(rapport.date_signalement);
      const statusCell = document.createElement('td');
      const select = document.createElement('select');
      select.className = 'report-state-select';
      select.setAttribute('aria-label', `État du signalement ${rapport.question_id || ''}`);
      [
        ['nouveau', 'À traiter'],
        ['corrige', 'Corrigé'],
        ['rejete', 'Non retenu']
      ].forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        select.appendChild(option);
      });
      select.value = ['nouveau', 'corrige', 'rejete'].includes(rapport.statut) ? rapport.statut : 'nouveau';
      select.addEventListener('change', () => mettreAJourStatutSignalement(rapport, select));
      statusCell.appendChild(select);
      row.append(questionCell, commentCell, dateCell, statusCell);
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error('Erreur de chargement des signalements :', error);
    afficherLigneVide(tbody, 4, 'Les signalements ne peuvent pas être chargés pour le moment.');
    if (badge) badge.textContent = 'Erreur de chargement';
  }
}

async function mettreAJourStatutSignalement(rapport, select) {
  if (!supabase || !rapport?.id) return;
  const ancienStatut = rapport.statut;
  const nouveauStatut = select.value;
  select.disabled = true;
  try {
    const { error } = await supabase.from('question_reports').update({ statut: nouveauStatut }).eq('id', rapport.id);
    if (error) throw error;
    rapport.statut = nouveauStatut;
    afficherAdminFeedback('État du signalement mis à jour.', false);
    await chargerSignalements();
  } catch (error) {
    console.error('Erreur de mise à jour du signalement :', error);
    select.value = ancienStatut;
    select.disabled = false;
    afficherAdminFeedback(`Impossible de modifier ce signalement : ${error.message || 'erreur inconnue'}`, true);
  }
}

async function initialiserGraphiqueActivite() {
  const canvas = document.getElementById('admin-activity-chart');
  const empty = document.getElementById('admin-chart-empty');
  if (!canvas) return;
  if (activityChart) {
    activityChart.destroy();
    activityChart = null;
  }
  if (!supabase || typeof window.Chart !== 'function') {
    canvas.classList.add('cache');
    empty?.classList.remove('cache');
    if (empty) empty.textContent = !supabase
      ? 'Les données d’activité sont indisponibles sans connexion Supabase.'
      : 'Le module de graphique n’a pas pu être chargé.';
    return;
  }

  try {
    const maintenant = Date.now();
    const ilYa24h = new Date(maintenant - 24 * 60 * 60 * 1000).toISOString();
    const { data: sessions, error } = await attendreRequeteSupabase(
      supabase
        .from('exam_sessions')
        .select('date_passage')
        .gte('date_passage', ilYa24h),
      'Le chargement de l’activité a dépassé le délai de réponse.'
    );
    if (error) throw error;

    canvas.classList.remove('cache');
    empty?.classList.add('cache');
    const labels = Array.from({ length: 12 }, (_, index) => `−${24 - index * 2} h`);
    const nombreParTranche = new Array(12).fill(0);
    (sessions || []).forEach(session => {
      const difference = maintenant - new Date(session.date_passage).getTime();
      const index = Math.floor((24 * 60 * 60 * 1000 - difference) / (2 * 60 * 60 * 1000));
      if (index >= 0 && index < 12) nombreParTranche[index]++;
    });

    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 240);
    gradient.addColorStop(0, 'rgba(49, 91, 78, .19)');
    gradient.addColorStop(1, 'rgba(49, 91, 78, 0)');
    activityChart = new window.Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{
        label: 'Sessions d’examen',
        data: nombreParTranche,
        borderColor: '#315b4e',
        backgroundColor: gradient,
        borderWidth: 2,
        fill: true,
        tension: .34,
        pointBackgroundColor: '#a85840',
        pointBorderColor: '#fffefa',
        pointBorderWidth: 2,
        pointRadius: 3.5,
        pointHoverRadius: 5
      }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: '#183b32', titleColor: '#fffefa', bodyColor: '#fffefa', padding: 10, cornerRadius: 5, displayColors: false }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#858a80', font: { size: 10, weight: 600 } } },
          y: { beginAtZero: true, ticks: { precision: 0, color: '#858a80', font: { size: 10, weight: 600 } }, grid: { color: '#ecece4', drawBorder: false } }
        },
        interaction: { intersect: false, mode: 'index' }
      }
    });
  } catch (error) {
    console.error('Erreur de chargement du graphique :', error);
    canvas.classList.add('cache');
    empty?.classList.remove('cache');
    if (empty) empty.textContent = 'Les données d’activité ne sont pas disponibles pour le moment.';
  }
}

async function mettreAJourKPIs() {
  if (!supabase) {
    ['admin-kpi-total', 'admin-kpi-actifs', 'admin-kpi-completion'].forEach(id => {
      const element = document.getElementById(id);
      if (element) element.textContent = '—';
    });
    return;
  }

  try {
    const debutJournee = new Date();
    debutJournee.setHours(0, 0, 0, 0);
    const [resultatProfils, resultatSessionsJour, resultatToutesSessions] = await Promise.all([
      attendreRequeteSupabase(
        supabase.from('profiles').select('id').eq('est_autorise', true),
        'Le comptage des comptes a dépassé le délai de réponse.'
      ),
      attendreRequeteSupabase(
        supabase.from('exam_sessions').select('user_id').gte('date_passage', debutJournee.toISOString()),
        'Le chargement des sessions du jour a dépassé le délai de réponse.'
      ),
      attendreRequeteSupabase(
        supabase.from('exam_sessions').select('score_total, total_questions'),
        'Le chargement des résultats a dépassé le délai de réponse.'
      )
    ]);
    if (resultatProfils.error) throw resultatProfils.error;
    if (resultatSessionsJour.error) throw resultatSessionsJour.error;
    if (resultatToutesSessions.error) throw resultatToutesSessions.error;

    animerNombre('admin-kpi-total', resultatProfils.data?.length || 0);
    const candidatsActifs = new Set((resultatSessionsJour.data || []).map(session => session.user_id)).size;
    animerNombre('admin-kpi-actifs', candidatsActifs);
    const sessions = resultatToutesSessions.data || [];
    const moyenne = sessions.length
      ? sessions.reduce((total, session) => total + (Number(session.total_questions) > 0 ? Number(session.score_total) / Number(session.total_questions) : 0), 0) / sessions.length
      : null;
    animerNombre('admin-kpi-completion', moyenne === null ? '—' : Math.round(moyenne * 100), '%');
  } catch (error) {
    console.error('Erreur de chargement des indicateurs :', error);
    afficherAdminFeedback('Certains indicateurs n’ont pas pu être actualisés.', true);
  }
}

function afficherLigneVide(tbody, colonnes, message) {
  tbody.replaceChildren();
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = colonnes;
  cell.className = 'table-empty';
  cell.textContent = message;
  row.appendChild(cell);
  tbody.appendChild(row);
}

function afficherAdminFeedback(message, erreur = false) {
  const element = document.getElementById('admin-feedback');
  if (!element) return;
  element.textContent = message;
  element.classList.toggle('error', erreur);
  element.classList.remove('cache');
  clearTimeout(element._timer);
  element._timer = setTimeout(() => element.classList.add('cache'), 5500);
}

function formaterDate(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function animerNombre(elementId, valeurCible, suffixe = '') {
  const element = document.getElementById(elementId);
  if (!element) return;
  const animationExistante = animationsKpi.get(elementId);
  if (animationExistante) cancelAnimationFrame(animationExistante);
  if (typeof valeurCible !== 'number' || !Number.isFinite(valeurCible)) {
    element.textContent = String(valeurCible);
    animationsKpi.delete(elementId);
    return;
  }
  const depart = parseInt(element.textContent, 10) || 0;
  const duree = 520;
  const debut = performance.now();
  const animer = maintenant => {
    const progression = Math.min((maintenant - debut) / duree, 1);
    const valeur = Math.round(depart + (valeurCible - depart) * progression);
    element.textContent = `${valeur.toLocaleString('fr-FR')}${suffixe}`;
    if (progression < 1) animationsKpi.set(elementId, requestAnimationFrame(animer));
    else animationsKpi.delete(elementId);
  };
  animationsKpi.set(elementId, requestAnimationFrame(animer));
}

document.addEventListener('DOMContentLoaded', () => {
  const filtre = document.getElementById('admin-filtre-moderation');
  filtre?.addEventListener('input', dessinerTableModeration);
  const actualiser = document.getElementById('admin-actualiser');
  actualiser?.addEventListener('click', async () => {
    actualiser.disabled = true;
    actualiser.setAttribute('aria-busy', 'true');
    try { await initialiserDashboardAdmin(); }
    finally { actualiser.disabled = false; actualiser.removeAttribute('aria-busy'); }
  });
});
