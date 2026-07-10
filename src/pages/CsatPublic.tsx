import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Star, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const CsatPublic: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [alreadyResponded, setAlreadyResponded] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) return;
    (supabase.rpc as any)('get_csat_survey_by_token', { p_token: token })
      .then(({ data, error }: any) => {
        if (error || !data || data.length === 0) {
          setNotFound(true);
        } else {
          setAlreadyResponded(!!data[0].already_responded);
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async () => {
    if (!token || rating === 0) return;
    setSubmitting(true);
    try {
      const { data, error } = await (supabase.rpc as any)('submit_csat_response', {
        p_token: token,
        p_rating: rating,
        p_comment: comment || null,
      });
      if (error || !data) throw error || new Error('Não foi possível enviar sua avaliação');
      setSubmitted(true);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <p className="text-slate-400 text-center">Link de avaliação inválido ou expirado.</p>
      </div>
    );
  }

  if (alreadyResponded || submitted) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
          <p className="text-white text-lg font-semibold">Obrigado pela sua avaliação!</p>
          <p className="text-slate-400 text-sm">Sua opinião nos ajuda a melhorar continuamente.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-sm w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-6 text-center">
        <h1 className="text-lg font-bold text-white">Como foi seu atendimento?</h1>
        <p className="text-sm text-slate-400">Sua avaliação é muito importante para nós.</p>

        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              aria-label={`${star} estrelas`}
            >
              <Star
                className={`w-9 h-9 transition-colors ${
                  (hoverRating || rating) >= star ? 'fill-amber-400 text-amber-400' : 'text-slate-700'
                }`}
              />
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Deixe um comentário (opcional)"
          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-white placeholder:text-slate-600 outline-none focus:ring-1 focus:ring-cyan-500/50 resize-none"
          rows={3}
        />

        <button
          onClick={handleSubmit}
          disabled={rating === 0 || submitting}
          className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-800 disabled:text-slate-600 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Enviar Avaliação
        </button>
      </div>
    </div>
  );
};

export default CsatPublic;
