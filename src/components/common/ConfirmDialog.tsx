'use client';

import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, CircularProgress } from '@mui/material';

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirmar', danger, loading, onConfirm, onClose }: {
  open: boolean; title: string; message: string; confirmLabel?: string; danger?: boolean; loading?: boolean;
  onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading} color="inherit">Cancelar</Button>
        <Button onClick={onConfirm} disabled={loading} variant="contained" color={danger ? 'error' : 'primary'}>
          {loading ? <CircularProgress size={18} color="inherit" /> : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
