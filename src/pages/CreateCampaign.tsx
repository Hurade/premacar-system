import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Check, ArrowLeft, ArrowRight, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Step1BasicInfo } from '@/components/campaigns/wizard/Step1BasicInfo';
import { Step2FlowConfig } from '@/components/campaigns/wizard/Step2FlowConfig';
import { Step3AddContacts } from '@/components/campaigns/wizard/Step3AddContacts';
import { Step4Review } from '@/components/campaigns/wizard/Step4Review';

export interface CampaignFormData {
  name: string;
  description: string;
  objective: string;
  duration: number;
  tags: string[];
  flow_config: Record<string, any>;
  contacts: string[]; // contact IDs
}

const DEFAULT_FLOW: Record<string, any> = {
  day1: {
    type: 'whatsapp',
    enabled: true,
    timing: { type: 'immediate' },
    config: { template: '', message: 'Olá {{nome}}, tudo bem?' },
    successConditions: [{ condition: 'replied', tag: 'Dia1_Respondeu', action: 'mark_success' }],
    failConditions: [{ condition: 'no_reply_24h', tag: 'Dia1_NaoRespondeu', action: 'advance_day' }],
  },
  day2: {
    type: 'whatsapp',
    enabled: true,
    timing: { type: 'delay', hours: 24 },
    config: { template: '', message: 'Oi {{nome}}, vi que não conseguimos conversar ontem...' },
    successConditions: [{ condition: 'replied', tag: 'Dia2_Respondeu', action: 'mark_success' }],
    failConditions: [{ condition: 'no_reply_24h', tag: 'Dia2_NaoRespondeu', action: 'advance_day' }],
  },
  day3: {
    type: 'whatsapp',
    enabled: true,
    timing: { type: 'delay', hours: 48 },
    config: { template: '', message: '{{nome}}, última tentativa de contato...' },
    successConditions: [{ condition: 'replied', tag: 'Dia3_Respondeu', action: 'mark_success' }],
    failConditions: [{ condition: 'no_reply_24h', tag: 'Dia3_NaoRespondeu', action: 'finalize' }],
  },
};

const STEPS = [
  { number: 1, label: 'Básico' },
  { number: 2, label: 'Fluxo' },
  { number: 3, label: 'Contatos' },
  { number: 4, label: 'Revisar' },
];

const CreateCampaignPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CampaignFormData>({
    name: '',
    description: '',
    objective: 'prospecting',
    duration: 3,
    tags: [],
    flow_config: DEFAULT_FLOW,
    contacts: [],
  });

  const progress = (currentStep / 4) * 100;

  const canAdvance = (): boolean => {
    switch (currentStep) {
      case 1: return !!formData.name && !!formData.objective;
      case 2: return Object.values(formData.flow_config).some((d: any) => d.enabled);
      case 3: return formData.contacts.length > 0;
      case 4: return true;
      default: return false;
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('recurring_campaigns')
        .insert({
          name: formData.name,
          description: formData.description || null,
          objective: formData.objective,
          flow_config: formData.flow_config,
          total_contacts: formData.contacts.length,
          in_progress_count: formData.contacts.length,
          status: 'active',
          user_id: user.id,
          created_by: user.id,
          started_at: new Date().toISOString(),
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Insert campaign contacts
      const campaignContacts = formData.contacts.map(contactId => ({
        campaign_id: (data as any).id,
        contact_id: contactId,
        current_day: 1,
        status: 'in_progress',
      }));

      if (campaignContacts.length > 0) {
        const { error: contactsError } = await supabase
          .from('campaign_contacts')
          .insert(campaignContacts as any);
        if (contactsError) throw contactsError;
      }

      toast.success('Campanha criada com sucesso!');
      navigate('/campanhas');
    } catch (error) {
      console.error('Erro ao criar campanha:', error);
      toast.error('Erro ao criar campanha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">📝 Criar Nova Campanha</h1>
          <Button variant="ghost" size="icon" onClick={() => navigate('/campanhas')}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Progress */}
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>Etapa {currentStep} de 4</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-8">
          {STEPS.map(step => (
            <button
              key={step.number}
              onClick={() => step.number < currentStep && setCurrentStep(step.number)}
              className="flex flex-col items-center gap-1.5 group"
              disabled={step.number > currentStep}
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                  step.number < currentStep
                    ? 'bg-primary border-primary text-primary-foreground'
                    : step.number === currentStep
                    ? 'border-primary text-primary bg-primary/10'
                    : 'border-border text-muted-foreground'
                }`}
              >
                {step.number < currentStep ? <Check className="w-4 h-4" /> : step.number}
              </div>
              <span className={`text-xs ${step.number === currentStep ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                {step.label}
              </span>
            </button>
          ))}
        </div>

        {/* Step Content */}
        <div className="bg-card/50 border border-border/50 rounded-xl p-6 min-h-[400px]">
          {currentStep === 1 && (
            <Step1BasicInfo data={formData} onChange={setFormData} />
          )}
          {currentStep === 2 && (
            <Step2FlowConfig data={formData} onChange={setFormData} />
          )}
          {currentStep === 3 && (
            <Step3AddContacts data={formData} onChange={setFormData} />
          )}
          {currentStep === 4 && (
            <Step4Review data={formData} onSubmit={handleSubmit} loading={loading} />
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : navigate('/campanhas')}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {currentStep === 1 ? 'Cancelar' : 'Voltar'}
          </Button>

          {currentStep < 4 ? (
            <Button
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={!canAdvance()}
              className="gap-2"
            >
              Próximo
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={loading || !canAdvance()}
              className="gap-2"
            >
              <Rocket className="w-4 h-4" />
              {loading ? 'Criando...' : 'Ativar Campanha'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateCampaignPage;
