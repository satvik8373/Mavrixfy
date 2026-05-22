import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { useForm } from 'react-hook-form';
import { Loader2, ImageIcon, Cloud, Globe, Lock } from 'lucide-react';
import { Playlist } from '@/types';
import { toast } from 'sonner';
import { uploadImage, getPlaceholderImageUrl } from '@/services/cloudinaryService';
import { usePlaylistStore } from '@/stores/usePlaylistStore';
import { Switch } from '../ui/switch';
import { ContentLoading, ButtonLoading } from '@/components/ui/loading';

// Helper function to get a default playlist image URL
const getDefaultPlaylistImage = (name: string) => {
  // In a real app, you might use a service to generate a placeholder image based on the name
  // For now, just return a static placeholder
  return '/default-playlist.jpg';
};

interface EditPlaylistDialogProps {
  isOpen: boolean;
  onClose: () => void;
  playlist: Playlist;
}

interface EditPlaylistFormData {
  name: string;
  description: string;
  isPublic: boolean;
}


interface PlaylistImageSectionProps {
  imagePreview: string | null;
  isUploading: boolean;
  uploadProgress: number;
  isSubmitting: boolean;
  imageError: string;
  imageFile: File | null;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleImageClick: () => void;
  handleImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  testDirectUpload: () => void;
}

const PlaylistImageSection = ({
  imagePreview,
  isUploading,
  uploadProgress,
  isSubmitting,
  imageError,
  imageFile,
  fileInputRef,
  handleImageClick,
  handleImageChange,
  testDirectUpload,
}: PlaylistImageSectionProps) => {
  return (
    <div className="flex flex-col items-center justify-center mb-4">
      <div 
        role="button"
        tabIndex={0}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
        className="relative w-40 h-40 rounded-md overflow-hidden bg-gray-100 cursor-pointer group"
        onClick={handleImageClick}
      >
        {imagePreview ? (
          <img 
            src={imagePreview} 
            alt="Playlist Cover" 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            <ImageIcon className="h-12 w-12 text-gray-400" />
          </div>
        )}
        <div className="absolute inset-0 bg-zinc-950 bg-opacity-50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <span className="text-white text-sm font-medium">Change Cover</span>
        </div>
        {isUploading && (
          <div className="absolute inset-0 bg-zinc-950 bg-opacity-50 flex flex-col items-center justify-center">
            <ContentLoading text={`Uploading... ${uploadProgress}%`} height="h-full" />
          </div>
        )}
      </div>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleImageChange}
        disabled={isSubmitting || isUploading}
      />
      <div className="mt-2 text-center">
        <p className="text-xs text-muted-foreground">
          Cover image is required
        </p>
        {imageError && (
          <p className="text-xs text-red-500 mt-1">{imageError}</p>
        )}
      </div>
      
      {imageFile && (
        <div className="flex justify-center mt-2">
          <Button 
            type="button" 
            variant="outline" 
            size="sm"
            className="text-xs"
            onClick={testDirectUpload}
            disabled={isUploading || !imageFile}
          >
            <Cloud className="h-3 w-3 mr-1" />
            Test Direct Upload
          </Button>
        </div>
      )}
    </div>
  );
};

export function EditPlaylistDialog({ isOpen, onClose, playlist }: EditPlaylistDialogProps) {
  const [state, setState] = useState({
    imagePreview: playlist.imageUrl || getPlaceholderImageUrl(playlist.name),
    isUploading: false,
    uploadProgress: 0,
    isSubmitting: false,
    imageError: '',
    imageFile: null as File | null,
  });
  const { imagePreview, isUploading, uploadProgress, isSubmitting, imageError, imageFile } = state;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { updatePlaylist } = usePlaylistStore();

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<EditPlaylistFormData>({
    defaultValues: {
      name: playlist.name,
      description: playlist.description || '',
      isPublic: playlist.isPublic !== undefined ? playlist.isPublic : true,
    }
  });

  // Watch the isPublic value to use in the UI
  const isPublic = watch('isPublic');

  useEffect(() => {
    if (playlist) {
      reset({
        name: playlist.name,
        description: playlist.description || '',
        isPublic: playlist.isPublic !== undefined ? playlist.isPublic : true,
      });
      setState(prev => ({
        ...prev,
        imagePreview: playlist.imageUrl || getPlaceholderImageUrl(playlist.name),
        imageError: '',
      }));
    }
  }, [playlist, reset]);

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      setState(prev => ({ ...prev, imageError: 'Please upload an image file' }));
      toast.error('Please upload an image file');
      return;
    }

    // Check file size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setState(prev => ({ ...prev, imageError: 'Image must be less than 5MB' }));
      toast.error('Image must be less than 5MB');
      return;
    }

    // Create a preview URL
    const previewUrl = URL.createObjectURL(file);
    setState(prev => ({
      ...prev,
      imageFile: file,
      imagePreview: previewUrl,
      imageError: '',
    }));
  };

  // Test direct upload to Cloudinary
  const testDirectUpload = async () => {
    if (!imageFile) {
      setState(prev => ({ ...prev, imageError: 'Please select an image first' }));
      toast.error('Please select an image first');
      return;
    }

    try {
      setState(prev => ({ ...prev, isUploading: true }));
      
      // Create form data
      const formData = new FormData();
      formData.append('file', imageFile);
      formData.append('upload_preset', 'spotify_clone');
      formData.append('cloud_name', 'djqq8kba8');
      formData.append('folder', 'spotify_clone/playlists');
      
      // Make direct upload request to Cloudinary
      const response = await fetch(
        'https://api.cloudinary.com/v1_1/djqq8kba8/image/upload',
        {
          method: 'POST',
          body: formData
        }
      );
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Show success and update preview
      toast.success('Direct upload successful!');
      setState(prev => ({ ...prev, imagePreview: result.secure_url }));
    } catch (error: any) {
      toast.error(`Direct upload failed: ${error.message || 'Unknown error'}`);
    } finally {
      setState(prev => ({ ...prev, isUploading: false }));
    }
  };

  const uploadImageToCloudinary = async (file: File): Promise<string> => {
    setState(prev => ({ ...prev, isUploading: true }));
    try {
      // Upload the image to Cloudinary and track progress
      const imageUrl = await uploadImage(file, (progress) => {
        setState(prev => ({ ...prev, uploadProgress: progress }));
      });
      
      return imageUrl;
    } catch (error) {
      toast.error('Failed to upload image. Using default image instead.');
      // Return a placeholder image URL on error
      return getPlaceholderImageUrl(playlist.name);
    } finally {
      setState(prev => ({ ...prev, isUploading: false, uploadProgress: 0 }));
    }
  };

  const handlePrivacyToggle = (checked: boolean) => {
    setValue('isPublic', checked);
  };

  const onSubmit = async (data: EditPlaylistFormData) => {
    // Check if we have an image (either from the original playlist or a new upload)
    if (!imagePreview && !imageFile && !playlist.imageUrl) {
      setState(prev => ({ ...prev, imageError: 'A cover image is required' }));
      toast.error('Please upload a cover image');
      return;
    }

    try {
      setState(prev => ({ ...prev, isSubmitting: true }));
      
      // Use the existing image URL by default
      let imageUrl = playlist.imageUrl;
      
      // If a new image was selected, upload it to Cloudinary
      if (imageFile) {
        try {
          imageUrl = await uploadImageToCloudinary(imageFile);
        } catch (uploadError) {
          // Continue with playlist update even if image upload fails
        }
      }

      // Get the correct ID (support both _id and id formats for compatibility)
      const playlistId = playlist._id || playlist.id;
      
      if (!playlistId) {
        throw new Error('Invalid playlist ID');
      }

      // Update playlist using the store
      await updatePlaylist(playlistId, {
        name: data.name,
        description: data.description,
        isPublic: data.isPublic,
        imageUrl,
      });
      
      toast.success('Playlist updated successfully!');
      
      onClose();
    } catch (error) {
      toast.error('Could not update the playlist. Please try again.');
    } finally {
      setState(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  const dialogCloseHandler = () => {
    reset();
    setState(prev => ({
      ...prev,
      imageFile: null,
      imageError: '',
      imagePreview: playlist.imageUrl || getPlaceholderImageUrl(playlist.name),
    }));
    onClose();
  };

  // Check if we have a valid image (either from original playlist or new upload)
  const hasValidImage = !!imagePreview || !!imageFile || !!playlist.imageUrl;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && dialogCloseHandler()}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Edit Playlist</DialogTitle>
            <DialogDescription>
              Update your playlist details.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
                        <PlaylistImageSection
              imagePreview={imagePreview}
              isUploading={isUploading}
              uploadProgress={uploadProgress}
              isSubmitting={isSubmitting}
              imageError={imageError}
              imageFile={imageFile}
              fileInputRef={fileInputRef}
              handleImageClick={handleImageClick}
              handleImageChange={handleImageChange}
              testDirectUpload={testDirectUpload}
            />
            
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                {...register('name', { required: 'Name is required' })}
                className="col-span-3"
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description" className="text-right">
                Description
              </Label>
              <Textarea
                id="description"
                {...register('description')}
                className="col-span-3"
                rows={4}
              />
            </div>
            
            {/* Privacy Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="mr-2">
                  {isPublic ? (
                    <Globe className="h-4 w-4 text-green-500" />
                  ) : (
                    <Lock className="h-4 w-4 text-zinc-500" />
                  )}
                </div>
                <div>
                  <Label htmlFor="privacy-toggle" className="font-medium">
                    {isPublic ? 'Public' : 'Private'}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {isPublic 
                      ? 'Anyone can find and listen to this playlist.' 
                      : 'Only you can access this playlist.'}
                  </p>
                </div>
              </div>
              <Switch 
                id="privacy-toggle"
                checked={isPublic}
                onCheckedChange={handlePrivacyToggle}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={dialogCloseHandler}
              disabled={isSubmitting || isUploading}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={isSubmitting || isUploading || !hasValidImage || !watch('name')}
            >
              {isSubmitting || isUploading ? (
                <ButtonLoading text={isUploading ? 'Uploading...' : 'Saving...'} />
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default EditPlaylistDialog;
