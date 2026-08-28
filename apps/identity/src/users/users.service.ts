import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { getAddress, isAddress } from 'viem';
import { UsersRepository } from './users.repository';
import { User } from '../database/schema/users.schema';
import { USERS_ERRORS } from './users.constants';

/**
 * Service managing user domain operations:
 * - EVM address checksum validation and normalization (EIP-55).
 * - User lookup and profile queries.
 * - Automatic user registration during authentication.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly usersRepository: UsersRepository) {}

  /**
   * Validates and normalizes an EVM address to EIP-55 Checksum format.
   *
   * @param address - Raw EVM wallet address string
   * @returns Checksum-normalized address string (e.g. 0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed)
   * @throws {BadRequestException} If the address is invalid or malformed
   */
  normalizeAddress(address: string): string {
    if (!address || !isAddress(address)) {
      throw new BadRequestException(USERS_ERRORS.invalidWalletAddress(address));
    }
    return getAddress(address);
  }

  /**
   * Retrieves a user entity by its UUID.
   *
   * @param id - Unique user identifier (UUIDv7)
   * @returns User entity
   * @throws {NotFoundException} If no user exists with the given ID
   */
  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(USERS_ERRORS.userNotFoundById(id));
    }
    return user;
  }

  /**
   * Retrieves a user entity by their normalized EVM wallet address.
   *
   * @param walletAddress - Raw or normalized EVM wallet address
   * @returns User entity
   * @throws {NotFoundException} If no user exists with the given address
   */
  async findByAddress(walletAddress: string): Promise<User> {
    const normalized = this.normalizeAddress(walletAddress);
    const user = await this.usersRepository.findByWalletAddress(normalized);
    if (!user) {
      throw new NotFoundException(USERS_ERRORS.userNotFoundByAddress(normalized));
    }
    return user;
  }

  /**
   * Finds an existing user by wallet address or creates a new user profile.
   *
   * @param walletAddress - Raw EVM wallet address
   * @returns Object containing the user entity and an `isNew` boolean flag
   */
  async findOrCreate(walletAddress: string): Promise<{ user: User; isNew: boolean }> {
    const normalized = this.normalizeAddress(walletAddress);
    const result = await this.usersRepository.findOrCreateByWalletAddress(normalized);
    if (result.isNew) {
      this.logger.log(`New user registered: ${normalized} (ID: ${result.user.id})`);
    }
    return result;
  }
}
