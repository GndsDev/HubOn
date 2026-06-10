import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { FeedbackService } from '../../core/services/feedback.service';
import { UserApiService } from '../../core/services/user-api.service';
import {
  CollectionItem,
  CollectionPageComponent,
} from '../../shared/components/collection-page/collection-page.component';
import { User } from '../../shared/models/user.model';
import { apiErrorMessage } from '../../shared/util/api-error';

@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [CollectionPageComponent],
  template: `
    <app-collection-page
      kicker="Gestão parcial"
      title="Usuários"
      description="Consulta dos usuários locais disponíveis. Cadastro, login e permissões avançadas não fazem parte deste MVP."
      actionLabel="Novo usuário"
      actionIcon="pi pi-user-plus"
      sectionEyebrow="API local"
      sectionTitle="Usuários cadastrados"
      [items]="items()"
      [loading]="loading()"
      [errorMessage]="error()"
      (retry)="load()"
      (action)="createNotice()"
    />
  `,
})
export class UsersPageComponent implements OnInit {
  private readonly api = inject(UserApiService);
  private readonly feedback = inject(FeedbackService);

  readonly users = signal<User[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly items = computed<CollectionItem[]>(() =>
    this.users().map((user) => ({
      title: user.name,
      subtitle: user.email,
      meta: `Perfis: ${user.roles.length ? user.roles.join(', ') : 'Nenhum perfil'}`,
      value: user.active ? 'Disponível' : 'Indisponível',
      status: user.active ? 'Ativo' : 'Inativo',
      tone: user.active ? 'success' : 'neutral',
      icon: 'pi pi-user',
    })),
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .getAll()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (users) => this.users.set(users),
        error: (error) => this.error.set(apiErrorMessage(error)),
      });
  }

  createNotice(): void {
    this.feedback.info('Funcionalidade em desenvolvimento.');
  }
}
