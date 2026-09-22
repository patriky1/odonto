import { useEffect, useRef, useState } from 'react';
import { Camera, Upload, Trash2, RefreshCw, Check, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from './Modal';
import { prepararImagem } from './FotoUpload';
import { getInitials, getAvatarColor } from '../../utils/formatters';

const LADO_FOTO = 600; // foto de perfil não precisa ser grande

/** Avatar do paciente: mostra a foto, ou as iniciais quando não houver. */
export function AvatarPaciente({ paciente, tamanho = 36, fonte = 13 }) {
  const [erro, setErro] = useState(false);
  useEffect(() => setErro(false), [paciente?.foto]);
  if (paciente?.foto && !erro) {
    return (
      <img src={paciente.foto} alt={`Foto de ${paciente.nome}`} onError={() => setErro(true)}
        style={{ width: tamanho, height: tamanho, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, display: 'block' }} />
    );
  }
  return (
    <div className="avatar" style={{ background: getAvatarColor(paciente?.id), width: tamanho, height: tamanho, fontSize: fonte }}>
      {getInitials(paciente?.nome)}
    </div>
  );
}

/**
 * Janela para definir a foto do paciente:
 *  - "Usar câmera": abre a webcam (computador) ou a câmera (celular)
 *  - "Escolher arquivo": anexa uma imagem já existente
 * Chama onSalvar(dataUrl) — ou onSalvar('') para remover.
 */
export default function FotoPacienteModal({ aberto, onFechar, fotoAtual, onSalvar }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const arquivoRef = useRef(null);
  const [modo, setModo] = useState('inicio'); // inicio | camera | previa
  const [previa, setPrevia] = useState('');
  const [cameras, setCameras] = useState([]);
  const [cameraAtual, setCameraAtual] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [iniciandoCamera, setIniciandoCamera] = useState(false);

  const pararCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    if (!aberto) { pararCamera(); setModo('inicio'); setPrevia(''); }
    return pararCamera;
  }, [aberto]);

  const abrirCamera = async (indice = cameraAtual) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Este navegador não permite usar a câmera aqui. Use "Escolher arquivo". (A câmera exige endereço https ou localhost.)', { duration: 6000 });
      return;
    }
    setIniciandoCamera(true);
    pararCamera();
    try {
      const lista = cameras.length ? cameras : [];
      const deviceId = lista[indice]?.deviceId;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setModo('camera');
      // Lista as câmeras depois da permissão (antes disso os nomes vêm vazios)
      const dispositivos = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
      setCameras(dispositivos);
      setTimeout(() => { if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); } }, 0);
    } catch (e) {
      const msg = e?.name === 'NotAllowedError'
        ? 'Permissão da câmera negada. Libere o acesso no ícone de cadeado ao lado do endereço.'
        : e?.name === 'NotFoundError' ? 'Nenhuma câmera encontrada neste aparelho.' : 'Não foi possível abrir a câmera.';
      toast.error(msg, { duration: 6000 });
    } finally {
      setIniciandoCamera(false);
    }
  };

  const trocarCamera = () => {
    const proxima = (cameraAtual + 1) % Math.max(cameras.length, 1);
    setCameraAtual(proxima);
    abrirCamera(proxima);
  };

  const capturar = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    // Recorte quadrado central, reduzido para o tamanho de perfil
    const lado = Math.min(video.videoWidth, video.videoHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(lado, LADO_FOTO);
    canvas.height = canvas.width;
    canvas.getContext('2d').drawImage(
      video, (video.videoWidth - lado) / 2, (video.videoHeight - lado) / 2, lado, lado, 0, 0, canvas.width, canvas.height,
    );
    setPrevia(canvas.toDataURL('image/jpeg', 0.85));
    pararCamera();
    setModo('previa');
  };

  const escolherArquivo = async (e) => {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    if (!arquivo.type.startsWith('image/')) { toast.error('Selecione um arquivo de imagem'); return; }
    if (arquivo.size > 15 * 1024 * 1024) { toast.error('Imagem muito grande (máximo 15 MB)'); return; }
    try {
      pararCamera();
      setPrevia(await prepararImagem(arquivo, LADO_FOTO));
      setModo('previa');
    } catch (err) {
      toast.error(err.message || 'Falha ao processar a imagem');
    }
  };

  const salvar = async (valor) => {
    setSalvando(true);
    try {
      await onSalvar(valor);
      onFechar();
    } catch { /* mensagem já exibida */ } finally {
      setSalvando(false);
    }
  };

  const quadro = { width: '100%', maxWidth: 360, aspectRatio: '1 / 1', margin: '0 auto', borderRadius: 12, overflow: 'hidden', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' };

  return (
    <Modal open={aberto} onClose={onFechar} title="Foto do paciente"
      footer={modo === 'previa' ? (
        <>
          <button className="btn btn-secondary" onClick={() => { setPrevia(''); setModo('inicio'); }} disabled={salvando}><X size={15} /> Descartar</button>
          <button className="btn btn-primary" onClick={() => salvar(previa)} disabled={salvando}>
            {salvando ? <Loader2 size={15} className="girando" /> : <Check size={15} />} Usar esta foto
          </button>
        </>
      ) : modo === 'camera' ? (
        <>
          <button className="btn btn-secondary" onClick={() => { pararCamera(); setModo('inicio'); }}>Cancelar</button>
          {cameras.length > 1 && <button className="btn btn-secondary" onClick={trocarCamera}><RefreshCw size={15} /> Trocar câmera</button>}
          <button className="btn btn-primary" onClick={capturar}><Camera size={15} /> Tirar foto</button>
        </>
      ) : (
        <button className="btn btn-secondary" onClick={onFechar}>Fechar</button>
      )}
    >
      {modo === 'camera' && (
        <div style={quadro}>
          <video ref={videoRef} className="webcam-video" playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
        </div>
      )}

      {modo === 'previa' && (
        <div style={quadro}><img src={previa} alt="Prévia" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
      )}

      {modo === 'inicio' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ ...quadro, maxWidth: 180, borderRadius: '50%', marginBottom: 20 }}>
            {fotoAtual
              ? <img src={fotoAtual} alt="Foto atual" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <Camera size={40} color="var(--text-muted)" />}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => abrirCamera()} disabled={iniciandoCamera}>
              {iniciandoCamera ? <Loader2 size={16} className="girando" /> : <Camera size={16} />} Usar câmera
            </button>
            <button className="btn btn-secondary" onClick={() => arquivoRef.current?.click()}>
              <Upload size={16} /> Escolher arquivo
            </button>
            {fotoAtual && (
              <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => salvar('')} disabled={salvando}>
                <Trash2 size={16} /> Remover foto
              </button>
            )}
          </div>
          <input ref={arquivoRef} type="file" accept="image/*" onChange={escolherArquivo} style={{ display: 'none' }} />
          <p className="text-xs text-muted mt-4">A foto é recortada em formato quadrado e reduzida antes do envio.</p>
        </div>
      )}
    </Modal>
  );
}
