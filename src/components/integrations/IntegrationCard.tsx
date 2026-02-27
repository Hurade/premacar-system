import React from 'react';
import { Settings, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

interface IntegrationCardProps {
  icon: string;
  name: string;
  description: string;
  configured: boolean;
  enabled: boolean;
  onConfigure: () => void;
}

const IntegrationCard: React.FC<IntegrationCardProps> = ({
  icon, name, description, configured, enabled, onConfigure
}) => {
  return (
    <div className="flex items-center justify-between p-5 bg-slate-900/60 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors">
      <div className="flex items-center gap-4">
        <span className="text-3xl">{icon}</span>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-white">{name}</h3>
            {configured ? (
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] px-1.5 py-0">
                <CheckCircle className="w-3 h-3 mr-1" />
                Configurado
              </Badge>
            ) : (
              <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/20 text-[10px] px-1.5 py-0">
                <XCircle className="w-3 h-3 mr-1" />
                Não configurado
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-0.5">{description}</p>
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onConfigure}
        className="gap-2 border-slate-700 text-slate-300 hover:text-white"
      >
        <Settings className="w-4 h-4" />
        Configurar
      </Button>
    </div>
  );
};

export default IntegrationCard;
