
import React, { useState } from 'react';
import { GuitarProfile, TuningPreset } from '../types';
import { TUNING_PRESETS, getOffsetNoteName, NOTES_SHARP, STANDARD_TUNING_OFFSETS } from '../constants';

interface GuitarSettingsProps {
  profiles: GuitarProfile[];
  activeProfileId: string;
  onProfileChange: (profileId: string) => void;
  onProfileUpdate: (updatedProfile: GuitarProfile) => void;
  onProfileCreate: (newProfile: GuitarProfile) => void;
  onClose: () => void;
}

const GuitarSettings: React.FC<GuitarSettingsProps> = ({
  profiles,
  activeProfileId,
  onProfileChange,
  onProfileUpdate,
  onProfileCreate,
  onClose
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<GuitarProfile | null>(null);

  const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0];

  const handleStartEdit = (profile: GuitarProfile) => {
    setEditingId(profile.id);
    setEditForm({ ...profile });
  };

  const handleSaveEdit = () => {
    if (editForm) {
      onProfileUpdate(editForm);
      setEditingId(null);
      setEditForm(null);
    }
  };

  const handleCreateNew = () => {
    const newProfile: GuitarProfile = {
      id: Date.now().toString(),
      name: 'New Guitar',
      tuningName: 'Standard (EADGBE)',
      tuning: [...STANDARD_TUNING_OFFSETS]
    };
    onProfileCreate(newProfile);
    // Switch to editing the new profile immediately
    setEditingId(newProfile.id);
    setEditForm(newProfile);
  };

  const handleTuningPresetChange = (presetName: string) => {
    if (!editForm) return;

    if (presetName === 'Custom') {
      setEditForm({ ...editForm, tuningName: 'Custom' });
    } else {
      const preset = TUNING_PRESETS.find(p => p.name === presetName);
      if (preset) {
        setEditForm({
          ...editForm,
          tuningName: preset.name,
          tuning: [...preset.offsets]
        });
      }
    }
  };

  const handleStringTuneChange = (stringIdx: number, offsetValue: string) => {
    if (!editForm) return;
    const newTuning = [...editForm.tuning];
    newTuning[stringIdx] = parseInt(offsetValue, 10);
    setEditForm({
      ...editForm,
      tuningName: 'Custom',
      tuning: newTuning
    });
  };

  // Helper to generate selectable pitch options for "Custom" tuning
  // Range: From C2 (-4) to E4 (24) roughly
  const generatePitchOptions = () => {
    const options = [];
    for (let i = -8; i <= 24; i++) {
      const noteName = getOffsetNoteName(i);
      // Rough octave estimation: E2 is 0.
      let octave = 2;
      if (i >= 20) octave = 4;
      else if (i >= 8) octave = 3;
      else if (i < -3) octave = 1;
      
      // Fine tuning octave display logic relative to C
      // C2 is -4 relative to E2=0? 
      // E2 (0). C2 is 4 semitones down from E2.
      // C: 0, C#: 1... E: 4.
      // So C2 is offset -4. C3 is offset 8. C4 is offset 20.
      let displayOctave = 2;
      if (i >= 20) displayOctave = 4;
      else if (i >= 8) displayOctave = 3;
      else if (i < -4) displayOctave = 1;

      options.push({ value: i, label: `${noteName}${displayOctave}` });
    }
    return options;
  };
  const pitchOptions = generatePitchOptions();

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="flex justify-between items-center p-6 border-b border-gray-700 bg-gray-900">
          <h2 className="text-2xl font-bold text-white">Guitar Configuration</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          
          {/* Active Profile Selection */}
          <div className="space-y-4">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Select Active Guitar</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {profiles.map(profile => (
                <button
                  key={profile.id}
                  onClick={() => onProfileChange(profile.id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all relative overflow-hidden group ${
                    activeProfileId === profile.id 
                      ? 'border-blue-500 bg-blue-900/20' 
                      : 'border-gray-700 bg-gray-800 hover:border-gray-500'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`font-bold ${activeProfileId === profile.id ? 'text-blue-400' : 'text-white'}`}>
                      {profile.name}
                    </span>
                    {activeProfileId === profile.id && (
                      <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold">Active</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-400 mb-3">{profile.tuningName}</div>
                  
                  {/* Visual String Preview */}
                  <div className="flex gap-1">
                    {profile.tuning.map((offset, idx) => (
                      <div key={idx} className="flex-1 h-1 rounded-full bg-gray-600 overflow-hidden relative">
                         <div className="absolute inset-0 bg-gray-500" style={{ top: `${(24-offset)/24 * 100}%` }}></div>
                      </div>
                    ))}
                  </div>

                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div 
                      onClick={(e) => { e.stopPropagation(); handleStartEdit(profile); }}
                      className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 cursor-pointer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </div>
                  </div>
                </button>
              ))}
              
              <button 
                onClick={handleCreateNew}
                className="p-4 rounded-xl border-2 border-dashed border-gray-700 hover:border-gray-500 hover:bg-gray-800/50 flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-gray-300 transition-all min-h-[120px]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="font-bold text-sm">Add New Guitar</span>
              </button>
            </div>
          </div>

          {/* Edit Mode Section */}
          {editingId && editForm && (
            <div className="mt-4 p-6 bg-gray-900/50 rounded-xl border border-gray-700 animate-fade-in">
              <h3 className="text-lg font-bold text-white mb-4">Edit {editForm.name}</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Guitar Name</label>
                  <input 
                    type="text" 
                    value={editForm.name}
                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tuning Preset</label>
                  <select 
                    value={TUNING_PRESETS.some(p => p.name === editForm.tuningName) ? editForm.tuningName : 'Custom'}
                    onChange={(e) => handleTuningPresetChange(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:border-blue-500 outline-none"
                  >
                    {TUNING_PRESETS.map(p => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                    <option value="Custom">Custom</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">String Tuning (Low to High)</label>
                  <div className="grid grid-cols-6 gap-2">
                    {editForm.tuning.map((offset, idx) => (
                      <div key={idx} className="flex flex-col gap-1">
                        <span className="text-[10px] text-center text-gray-500 font-mono">Str {idx + 1}</span>
                        <select
                          value={offset}
                          onChange={(e) => handleStringTuneChange(idx, e.target.value)}
                          className={`w-full bg-gray-800 border rounded px-1 py-2 text-xs text-center outline-none ${editForm.tuningName !== 'Custom' ? 'border-gray-700 text-gray-400 pointer-events-none' : 'border-gray-600 text-white focus:border-blue-500'}`}
                        >
                          {pitchOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={() => setEditingId(null)} className="px-4 py-2 text-gray-400 hover:text-white text-sm font-bold">Cancel</button>
                  <button onClick={handleSaveEdit} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold shadow-lg">Save Changes</button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default GuitarSettings;
