/* DUC Concours — console d'administration (rôle vérifié par Supabase) */
(() => {
const supabase = window.supabaseClient;
let activityChart = null;
let profilsCandidats = [];
let activiteParCompte = new Map();
let signalementsCharges = [];
let questionsParIdSignalements = new Map();
let signalementSuiviActuel = null;
let versionChargementSuivi = 0;
let boutonSuiviDeclencheur = null;
let versionChargementProfils = 0;
let versionChargementActivite = 0;
let boutonActiviteDeclencheur = null;
const animationsKpi = new Map();

const LIBELLES_STATUT_SIGNALEMENT = {
  nouveau: 'À traiter',
  corrige: 'Corrigé',
  rejete: 'Non retenu'
};

function libelleStatutSignalement(statut) {
  return LIBELLES_STATUT_SIGNALEMENT[statut] || LIBELLES_STATUT_SIGNALEMENT.nouveau;
}

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
    afficherLigneVide(tbody, 5, 'Connexion Supabase indisponible.');
    const badge = document.getElementById('admin-badge-moderation');
    if (badge) badge.textContent = 'Indisponible';
    return;
  }

  afficherLigneVide(tbody, 5, 'Chargement des comptes…');
  const badge = document.getElementById('admin-badge-moderation');
  if (badge) badge.textContent = 'Chargement…';
  try {
    const [resultatComptes, resultatSessions] = await Promise.allSettled([
      attendreRequeteSupabase(
        supabase
          .from('profiles')
          .select('id, nom_complet, email, role, est_autorise, date_inscription')
          .order('date_inscription', { ascending: false }),
        'La liste des comptes a dépassé le délai de réponse.'
      ),
      attendreRequeteSupabase(
        supabase
          .from('exam_sessions')
          .select('user_id, date_passage')
          .order('date_passage', { ascending: false }),
        'Le chargement de l’activité a dépassé le délai de réponse.'
      )
    ]);
    if (version !== versionChargementProfils) return;
    if (resultatComptes.status === 'rejected') throw resultatComptes.reason;
    const { data, error } = resultatComptes.value;
    if (error) throw error;

    profilsCandidats = Array.isArray(data) ? data : [];
    activiteParCompte = new Map();
    if (resultatSessions.status === 'fulfilled' && !resultatSessions.value.error) {
      (resultatSessions.value.data || []).forEach(session => {
        if (!session?.user_id) return;
        const entree = activiteParCompte.get(session.user_id) || { total: 0, derniere: null };
        entree.total += 1;
        const horodatage = session.date_passage ? new Date(session.date_passage).getTime() : NaN;
        if (!Number.isNaN(horodatage) && (entree.derniere === null || horodatage > entree.derniere)) {
          entree.derniere = horodatage;
        }
        activiteParCompte.set(session.user_id, entree);
      });
    } else {
      const raisonSessions = resultatSessions.status === 'rejected'
        ? resultatSessions.reason
        : resultatSessions.value.error;
      console.warn('Activité des comptes indisponible :', raisonSessions);
    }

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
    afficherLigneVide(tbody, 5, 'Impossible de charger les comptes. Réessayez dans quelques instants.');
    afficherAdminFeedback(`Impossible de charger les comptes : ${error.message || 'erreur inconnue'}`, true);
  }
}

function filtrerComptes() {
  const filtreTexte = (document.getElementById('admin-filtre-moderation')?.value || '').trim().toLocaleLowerCase('fr-FR');
  const filtreActivite = document.getElementById('admin-filtre-activite')?.value || 'tous';
  const seuil30Jours = Date.now() - 30 * 24 * 60 * 60 * 1000;

  return profilsCandidats.filter(profil => {
    const recherche = `${profil.nom_complet || ''} ${profil.email || ''} ${profil.role || ''}`.toLocaleLowerCase('fr-FR');
    if (!recherche.includes(filtreTexte)) return false;
    const activite = activiteParCompte.get(profil.id);
    if (filtreActivite === 'actifs') return Boolean(activite && activite.derniere && activite.derniere >= seuil30Jours);
    if (filtreActivite === 'inactifs') return Boolean(activite && activite.derniere && activite.derniere < seuil30Jours);
    if (filtreActivite === 'jamais') return !activite;
    return true;
  });
}

function formaterDateCourte(horodatage) {
  const date = new Date(horodatage);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function dessinerTableModeration() {
  const tbody = document.getElementById('admin-moderation-table');
  if (!tbody) return;
  const comptesFiltres = filtrerComptes();
  tbody.replaceChildren();

  if (comptesFiltres.length === 0) {
    afficherLigneVide(tbody, 5, profilsCandidats.length ? 'Aucun compte ne correspond à ces filtres.' : 'Aucun compte enregistré.');
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

    const activityCell = document.createElement('td');
    activityCell.className = 'admin-account-activity-cell';
    const activityButton = document.createElement('button');
    activityButton.type = 'button';
    activityButton.className = 'btn-voir-activite';
    activityButton.setAttribute('aria-label', `Voir l’activité de ${profil.nom_complet || profil.email || 'ce membre'}`);
    const eyeIcon = creerIconeOeil();
    const activityLabel = document.createElement('span');
    activityLabel.textContent = 'Voir';
    activityButton.append(eyeIcon, activityLabel);
    activityButton.addEventListener('click', () => ouvrirActiviteMembre(profil, activityButton));
    const activite = activiteParCompte.get(profil.id);
    const activityInfo = document.createElement('span');
    activityInfo.className = 'admin-account-activity-info';
    if (activite) {
      const dateDerniere = activite.derniere !== null ? formaterDateCourte(activite.derniere) : 'date inconnue';
      activityInfo.textContent = `${activite.total} séance${activite.total === 1 ? '' : 's'} · ${dateDerniere}`;
    } else {
      activityInfo.textContent = 'Aucune séance';
    }
    activityCell.append(activityButton, activityInfo);

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
    row.append(nameCell, roleCell, dateCell, activityCell, accessCell);
    tbody.appendChild(row);
  });
}

function exporterComptesCSV() {
  const comptes = filtrerComptes();
  if (comptes.length === 0) {
    afficherAdminFeedback('Aucun compte à exporter avec les filtres actuels.', true);
    return;
  }

  const echapper = valeur => `"${String(valeur ?? '').replace(/"/g, '""')}"`;
  const entetes = ['Nom', 'Email', 'Type', 'Inscrit le', 'Séances', 'Dernière activité', 'Accès'];
  const lignesComptes = comptes.map(profil => {
    const activite = activiteParCompte.get(profil.id);
    return [
      profil.nom_complet || '',
      profil.email || '',
      profil.role === 'admin' ? 'Administrateur' : 'Candidat',
      profil.date_inscription ? formaterDate(profil.date_inscription) : '',
      activite ? activite.total : 0,
      activite?.derniere ? formaterDateCourte(activite.derniere) : '',
      profil.est_autorise === true ? 'Accès autorisé' : 'En attente'
    ].map(echapper).join(';');
  });
  const csv = `\uFEFF${[entetes.map(echapper).join(';'), ...lignesComptes].join('\r\n')}`;
  const lien = document.createElement('a');
  lien.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  lien.download = `comptes-duc-concours-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  URL.revokeObjectURL(lien.href);
  afficherAdminFeedback(`${comptes.length} compte${comptes.length === 1 ? '' : 's'} exporté${comptes.length === 1 ? '' : 's'} en CSV.`, false);
}

function creerIconeOeil() {
  const espaceSvg = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(espaceSvg, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const contour = document.createElementNS(espaceSvg, 'path');
  contour.setAttribute('d', 'M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z');
  const pupille = document.createElementNS(espaceSvg, 'circle');
  pupille.setAttribute('cx', '12');
  pupille.setAttribute('cy', '12');
  pupille.setAttribute('r', '3');
  svg.append(contour, pupille);
  return svg;
}

function creerStatActivite(libelle, valeur) {
  const carte = document.createElement('div');
  carte.className = 'admin-activity-stat';
  const label = document.createElement('span');
  label.textContent = libelle;
  const contenu = document.createElement('strong');
  contenu.textContent = valeur;
  carte.append(label, contenu);
  return carte;
}

function formaterDateHeure(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function formaterDuree(secondes) {
  const total = Math.max(0, Number(secondes) || 0);
  const minutes = Math.floor(total / 60);
  const reste = total % 60;
  return minutes ? `${minutes} min ${String(reste).padStart(2, '0')} s` : `${reste} s`;
}

function fermerModalActivite() {
  const modal = document.getElementById('admin-activity-modal');
  if (modal) modal.classList.add('cache');
  versionChargementActivite += 1;
  boutonActiviteDeclencheur?.focus();
  boutonActiviteDeclencheur = null;
}

async function ouvrirActiviteMembre(profil, bouton) {
  const modal = document.getElementById('admin-activity-modal');
  const title = document.getElementById('admin-activity-title');
  const subtitle = document.getElementById('admin-activity-subtitle');
  const summary = document.getElementById('admin-activity-summary');
  const note = document.getElementById('admin-activity-note');
  const tbody = document.getElementById('admin-activity-table');
  if (!modal || !title || !summary || !tbody) return;

  const version = ++versionChargementActivite;
  boutonActiviteDeclencheur = bouton || null;
  title.textContent = profil.nom_complet || 'Activité du membre';
  if (subtitle) subtitle.textContent = profil.email || 'Séances de préparation enregistrées sur la plateforme.';
  summary.replaceChildren();
  summary.textContent = 'Chargement de l’activité…';
  if (note) note.textContent = '';
  afficherLigneVide(tbody, 5, 'Chargement des séances…');
  modal.classList.remove('cache');

  if (!supabase || !profil.id) {
    summary.textContent = 'La connexion aux données d’activité est indisponible.';
    afficherLigneVide(tbody, 5, 'Impossible de charger les séances de ce membre.');
    return;
  }

  if (bouton) bouton.disabled = true;
  try {
    const { data, error, count } = await attendreRequeteSupabase(
      supabase
        .from('exam_sessions')
        .select('id, mode, matiere, score_total, total_questions, duree_secondes, date_passage', { count: 'exact' })
        .eq('user_id', profil.id)
        .order('date_passage', { ascending: false })
        .limit(50),
      'Le chargement de l’activité du membre a dépassé le délai de réponse.'
    );
    if (version !== versionChargementActivite) return;
    if (error) throw error;

    const sessions = Array.isArray(data) ? data : [];
    const totalSessions = Number.isFinite(count) ? count : sessions.length;
    const totalQuestions = sessions.reduce((somme, session) => somme + (Number(session.total_questions) || 0), 0);
    const totalReponsesJustes = sessions.reduce((somme, session) => somme + (Number(session.score_total) || 0), 0);
    const scoreMoyen = totalQuestions ? `${Math.round(totalReponsesJustes / totalQuestions * 100)} %` : '—';
    const derniereActivite = sessions[0] ? formaterDateHeure(sessions[0].date_passage) : 'Aucune séance';

    summary.replaceChildren(
      creerStatActivite('Séances enregistrées', String(totalSessions)),
      creerStatActivite(totalSessions > sessions.length ? 'Score moyen récent' : 'Score moyen', scoreMoyen),
      creerStatActivite('Dernière activité', derniereActivite)
    );
    if (note) {
      note.textContent = totalSessions > sessions.length
        ? `Affichage des ${sessions.length} séances les plus récentes sur ${totalSessions}.`
        : 'Activité calculée à partir des séances de préparation enregistrées.';
    }

    tbody.replaceChildren();
    if (sessions.length === 0) {
      afficherLigneVide(tbody, 5, 'Aucune séance de préparation enregistrée pour ce membre.');
      return;
    }

    sessions.forEach(session => {
      const row = document.createElement('tr');
      const dateCell = document.createElement('td');
      dateCell.textContent = formaterDateHeure(session.date_passage);
      const modeCell = document.createElement('td');
      modeCell.textContent = session.mode === 'unidisciplinaire' ? 'Matière unique' : session.mode === 'standard' ? 'Concours' : session.mode || '—';
      const subjectCell = document.createElement('td');
      subjectCell.textContent = session.matiere || 'Toutes matières';
      const scoreCell = document.createElement('td');
      const score = Number(session.score_total) || 0;
      const questions = Number(session.total_questions) || 0;
      const pourcentage = questions ? ` · ${Math.round(score / questions * 100)} %` : '';
      scoreCell.textContent = `${score} / ${questions}${pourcentage}`;
      const durationCell = document.createElement('td');
      durationCell.textContent = formaterDuree(session.duree_secondes);
      row.append(dateCell, modeCell, subjectCell, scoreCell, durationCell);
      tbody.appendChild(row);
    });
  } catch (error) {
    if (version !== versionChargementActivite) return;
    console.error('Erreur de chargement de l’activité du membre :', error);
    summary.textContent = `Impossible de charger l’activité : ${error.message || 'erreur inconnue'}`;
    if (note) note.textContent = 'Réessayez plus tard ou vérifiez les droits de connexion.';
    afficherLigneVide(tbody, 5, 'Les séances de ce membre ne peuvent pas être chargées pour le moment.');
  } finally {
    if (bouton) bouton.disabled = false;
  }
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
    signalementsCharges = [];
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

    signalementsCharges = Array.isArray(data) ? data : [];
    const aTraiter = signalementsCharges.filter(rapport => (rapport.statut || 'nouveau') === 'nouveau').length;
    if (badge) badge.textContent = signalementsCharges.length
      ? `${aTraiter} à traiter · ${signalementsCharges.length} au total`
      : 'Aucun retour';

    questionsParIdSignalements = new Map();
    try {
      const questions = await db.questions.toArray();
      questionsParIdSignalements = new Map(questions.map(question => [question.id, question]));
    } catch (errorLecture) {
      console.warn('Le catalogue local ne peut pas enrichir les signalements :', errorLecture);
    }

    dessinerSignalements();
  } catch (error) {
    console.error('Erreur de chargement des signalements :', error);
    signalementsCharges = [];
    afficherLigneVide(tbody, 4, 'Les signalements ne peuvent pas être chargés pour le moment.');
    if (badge) badge.textContent = 'Erreur de chargement';
  }
}

function dessinerSignalements() {
  const tbody = document.getElementById('admin-signalements-table');
  if (!tbody) return;
  const filtreEtat = document.getElementById('admin-filtre-signalement')?.value || 'tous';
  const rapports = filtreEtat === 'tous'
    ? signalementsCharges
    : signalementsCharges.filter(rapport => (rapport.statut || 'nouveau') === filtreEtat);

  tbody.replaceChildren();
  if (rapports.length === 0) {
    afficherLigneVide(tbody, 4, signalementsCharges.length
      ? 'Aucun signalement ne correspond à cet état.'
      : 'Aucun signalement reçu.');
    return;
  }

  rapports.forEach(rapport => {
    const row = document.createElement('tr');
    const questionCell = document.createElement('td');
    const questionLabel = document.createElement('span');
    questionLabel.className = 'report-question';
    const question = questionsParIdSignalements.get(rapport.question_id);
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
    statusCell.className = 'report-state-cell';
    const select = document.createElement('select');
    select.className = 'report-state-select';
    select.setAttribute('aria-label', `État du signalement ${rapport.question_id || ''}`);
    Object.entries(LIBELLES_STATUT_SIGNALEMENT).forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    });
    select.value = LIBELLES_STATUT_SIGNALEMENT[rapport.statut] ? rapport.statut : 'nouveau';
    select.addEventListener('change', () => mettreAJourStatutSignalement(rapport, select));
    const suiviButton = document.createElement('button');
    suiviButton.type = 'button';
    suiviButton.className = 'btn-suivi-signalement';
    suiviButton.textContent = 'Suivi';
    suiviButton.setAttribute('aria-label', `Ouvrir le suivi du signalement ${rapport.question_id || ''}`);
    suiviButton.addEventListener('click', () => ouvrirSuiviSignalement(rapport, suiviButton));
    statusCell.append(select, suiviButton);
    row.append(questionCell, commentCell, dateCell, statusCell);
    tbody.appendChild(row);
  });
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
    const suiviEnregistre = await enregistrerSuiviSignalement(rapport, nouveauStatut, ancienStatut, null);
    afficherAdminFeedback(suiviEnregistre
      ? 'État du signalement mis à jour et décision ajoutée au suivi.'
      : 'État du signalement mis à jour.', false);
    await chargerSignalements();
  } catch (error) {
    console.error('Erreur de mise à jour du signalement :', error);
    select.value = ancienStatut;
    select.disabled = false;
    afficherAdminFeedback(`Impossible de modifier ce signalement : ${error.message || 'erreur inconnue'}`, true);
  }
}

async function enregistrerSuiviSignalement(rapport, nouveauStatut, ancienStatut, note) {
  if (!supabase || !rapport?.id) return false;
  try {
    const { data: reponse, error: erreurAuth } = await supabase.auth.getUser();
    if (erreurAuth) throw erreurAuth;
    const adminId = reponse?.user?.id;
    if (!adminId) throw new Error('Administrateur non identifié.');
    const { error } = await attendreRequeteSupabase(
      supabase.from('report_reviews').insert({
        report_id: rapport.id,
        admin_id: adminId,
        note: note || null,
        ancien_statut: ancienStatut || null,
        nouveau_statut: nouveauStatut
      }),
      'L’enregistrement du suivi a dépassé le délai de réponse.'
    );
    if (error) throw error;
    return true;
  } catch (error) {
    console.warn('Suivi du signalement non enregistré :', error);
    return false;
  }
}

function afficherMessageSuivi(message, erreur = false) {
  const element = document.getElementById('admin-report-message');
  if (!element) return;
  element.textContent = message;
  element.classList.toggle('error', erreur);
  element.classList.remove('cache');
}

function majBadgeStatutRapport(rapport) {
  const badge = document.getElementById('admin-report-statut-badge');
  if (!badge) return;
  const statut = LIBELLES_STATUT_SIGNALEMENT[rapport?.statut] ? rapport.statut : 'nouveau';
  badge.textContent = libelleStatutSignalement(statut);
  badge.classList.toggle('admin-account-status-authorized', statut !== 'nouveau');
  badge.classList.toggle('admin-account-status-pending', statut === 'nouveau');
}

function formaterDateHeureCourte(dateStr) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function dessinerHistoriqueSuivi(entrees) {
  const conteneur = document.getElementById('admin-report-historique');
  if (!conteneur) return;
  conteneur.replaceChildren();

  if (entrees.length === 0) {
    const vide = document.createElement('p');
    vide.className = 'empty-state';
    vide.textContent = 'Aucune décision ou note enregistrée pour le moment.';
    conteneur.appendChild(vide);
    return;
  }

  entrees.forEach(entree => {
    const item = document.createElement('div');
    item.className = 'report-historique-item';
    const date = document.createElement('span');
    date.className = 'report-historique-date';
    date.textContent = formaterDateHeureCourte(entree.created_at);
    const texte = document.createElement('span');
    texte.className = 'report-historique-texte';
    const ligneStatut = document.createElement('strong');
    if (entree.ancien_statut && entree.ancien_statut !== entree.nouveau_statut) {
      ligneStatut.textContent = `Statut : ${libelleStatutSignalement(entree.ancien_statut)} → ${libelleStatutSignalement(entree.nouveau_statut)}`;
    } else {
      ligneStatut.textContent = `Statut : ${libelleStatutSignalement(entree.nouveau_statut)}`;
    }
    texte.appendChild(ligneStatut);
    if (entree.note?.trim()) {
      const note = document.createElement('span');
      note.className = 'report-historique-note';
      note.textContent = entree.note.trim();
      texte.appendChild(note);
    }
    item.append(date, texte);
    conteneur.appendChild(item);
  });
}

async function chargerHistoriqueSuivi(rapport) {
  const conteneur = document.getElementById('admin-report-historique');
  if (!conteneur || !rapport?.id) return;
  const version = ++versionChargementSuivi;
  conteneur.replaceChildren();
  const chargement = document.createElement('p');
  chargement.className = 'empty-state';
  chargement.textContent = 'Chargement du suivi…';
  conteneur.appendChild(chargement);

  try {
    const { data, error } = await attendreRequeteSupabase(
      supabase
        .from('report_reviews')
        .select('id, note, ancien_statut, nouveau_statut, created_at')
        .eq('report_id', rapport.id)
        .order('created_at', { ascending: true }),
      'Le chargement du suivi a dépassé le délai de réponse.'
    );
    if (version !== versionChargementSuivi) return;
    if (error) throw error;
    dessinerHistoriqueSuivi(Array.isArray(data) ? data : []);
  } catch (error) {
    if (version !== versionChargementSuivi) return;
    console.error('Erreur de chargement du suivi du signalement :', error);
    conteneur.replaceChildren();
    const echec = document.createElement('p');
    echec.className = 'empty-state';
    echec.textContent = `Historique indisponible : ${error.message || 'erreur inconnue'}`;
    conteneur.appendChild(echec);
  }
}

async function ouvrirSuiviSignalement(rapport, bouton) {
  const modal = document.getElementById('admin-report-modal');
  if (!modal || !rapport?.id) return;
  signalementSuiviActuel = rapport;
  boutonSuiviDeclencheur = bouton || null;
  const question = questionsParIdSignalements.get(rapport.question_id);
  const titre = document.getElementById('admin-report-title');
  const questionId = document.getElementById('admin-report-question-id');
  const questionTexte = document.getElementById('admin-report-question-texte');
  const commentaire = document.getElementById('admin-report-comment-texte');
  const message = document.getElementById('admin-report-message');
  if (titre) titre.textContent = question?.question || 'Signalement';
  if (questionId) questionId.textContent = rapport.question_id || 'ID inconnu';
  if (questionTexte) questionTexte.textContent = question?.question || 'Question du catalogue non disponible sur cet appareil.';
  if (commentaire) commentaire.textContent = rapport.commentaire?.trim() || 'Aucun commentaire ajouté.';
  if (message) message.classList.add('cache');
  const note = document.getElementById('admin-report-note');
  if (note) note.value = '';
  majBadgeStatutRapport(rapport);
  modal.classList.remove('cache');
  if (bouton) bouton.disabled = true;
  try {
    await chargerHistoriqueSuivi(rapport);
  } finally {
    if (bouton) bouton.disabled = false;
  }
}

function fermerModalSuivi() {
  const modal = document.getElementById('admin-report-modal');
  if (modal) modal.classList.add('cache');
  versionChargementSuivi += 1;
  signalementSuiviActuel = null;
  boutonSuiviDeclencheur?.focus();
  boutonSuiviDeclencheur = null;
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

function connecterEvenementsDashboardAdmin() {
  const filtre = document.getElementById('admin-filtre-moderation');
  filtre?.addEventListener('input', dessinerTableModeration);
  document.getElementById('admin-filtre-activite')?.addEventListener('change', dessinerTableModeration);
  document.getElementById('admin-export-csv')?.addEventListener('click', exporterComptesCSV);
  document.getElementById('admin-filtre-signalement')?.addEventListener('change', dessinerSignalements);
  const actualiser = document.getElementById('admin-actualiser');
  actualiser?.addEventListener('click', async () => {
    actualiser.disabled = true;
    actualiser.setAttribute('aria-busy', 'true');
    try { await initialiserDashboardAdmin(); }
    finally { actualiser.disabled = false; actualiser.removeAttribute('aria-busy'); }
  });

  const modalActivite = document.getElementById('admin-activity-modal');
  const boutonFermerActivite = document.getElementById('admin-activity-close');
  boutonFermerActivite?.addEventListener('click', fermerModalActivite);
  modalActivite?.addEventListener('click', event => {
    if (event.target === modalActivite) fermerModalActivite();
  });

  const modalSuivi = document.getElementById('admin-report-modal');
  const boutonFermerSuivi = document.getElementById('admin-report-close');
  boutonFermerSuivi?.addEventListener('click', fermerModalSuivi);
  modalSuivi?.addEventListener('click', event => {
    if (event.target === modalSuivi) fermerModalSuivi();
  });
  document.getElementById('admin-report-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const rapport = signalementSuiviActuel;
    const zoneNote = document.getElementById('admin-report-note');
    const boutonEnvoyer = document.getElementById('admin-report-note-submit');
    const message = document.getElementById('admin-report-message');
    const note = zoneNote?.value.trim() || '';
    if (!rapport?.id) return;
    if (!note) {
      afficherMessageSuivi('Saisissez une note avant de l’ajouter au suivi.', true);
      zoneNote?.focus();
      return;
    }
    if (boutonEnvoyer) boutonEnvoyer.disabled = true;
    try {
      const enregistre = await enregistrerSuiviSignalement(rapport, rapport.statut || 'nouveau', null, note);
      if (!enregistre) {
        afficherMessageSuivi('La note n’a pas pu être enregistrée. Réessayez plus tard.', true);
        return;
      }
      if (zoneNote) zoneNote.value = '';
      if (message) message.classList.add('cache');
      afficherMessageSuivi('Note ajoutée au suivi de ce signalement.', false);
      await chargerHistoriqueSuivi(rapport);
    } finally {
      if (boutonEnvoyer) boutonEnvoyer.disabled = false;
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (modalSuivi && !modalSuivi.classList.contains('cache')) {
      fermerModalSuivi();
      return;
    }
    if (modalActivite && !modalActivite.classList.contains('cache')) {
      fermerModalActivite();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', connecterEvenementsDashboardAdmin, { once: true });
} else {
  connecterEvenementsDashboardAdmin();
}

window.initialiserDashboardAdmin = initialiserDashboardAdmin;
})();
